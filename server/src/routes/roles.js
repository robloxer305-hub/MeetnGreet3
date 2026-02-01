import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for updating user roles
const updateRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin']),
  permissions: z.array(z.string()).optional(),
  reason: z.string().optional(),
});

// Schema for assigning custom permissions
const assignPermissionsSchema = z.object({
  userId: z.string(),
  permissions: z.array(z.string()),
  reason: z.string().optional(),
});

// Get all users with their roles (admin only)
router.get('/users', requireAuth, async (req, res) => {
  try {
    const requestingUserId = req.user.id;
    const { page = 1, limit = 20, role, search } = req.query;

    // Check if user is admin
    const requestingUser = await User.findById(requestingUserId);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    let query = {};
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { displayName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('displayName avatarUrl email role permissions karma reputation level createdAt lastSeen onlineStatus isBanned')
      .sort({ role: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users with roles:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user role (admin only)
router.patch('/:userId/role', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, permissions, reason } = updateRoleSchema.parse(req.body);
    const adminUserId = req.user.id;

    // Check if requester is admin
    const adminUser = await User.findById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Cannot change role of another admin
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role === 'admin' && targetUser._id.toString() !== adminUserId) {
      return res.status(403).json({ error: 'Cannot change role of another admin' });
    }

    const oldRole = targetUser.role;
    targetUser.role = role;
    
    if (permissions) {
      targetUser.permissions = permissions;
    }

    await targetUser.save();

    // Log the role change
    adminUser.auditLog.push({
      action: 'user_role_updated',
      details: `Changed user ${userId} role from ${oldRole} to ${role}. Reason: ${reason || 'Not specified'}`,
      timestamp: new Date(),
    });
    await adminUser.save();

    // Send notification to target user
    await notificationService.createNotification({
      recipient: userId,
      type: 'system',
      title: 'Role Updated',
      message: `Your role has been changed to ${role}`,
      data: {
        oldRole,
        newRole: role,
      },
      channels: {
        inApp: true,
        push: targetUser.pushNotifications,
      },
    });

    res.json({
      message: 'User role updated successfully',
      oldRole,
      newRole: role,
      user: {
        id: targetUser._id,
        displayName: targetUser.displayName,
        role: targetUser.role,
        permissions: targetUser.permissions,
      },
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Assign custom permissions to user (admin/moderator only)
router.post('/permissions', requireAuth, async (req, res) => {
  try {
    const { userId, permissions, reason } = assignPermissionsSchema.parse(req.body);
    const adminUserId = req.user.id;

    // Check if requester is admin or moderator
    const requestingUser = await User.findById(adminUserId);
    if (!requestingUser || !['admin', 'moderator'].includes(requestingUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Moderators can only assign permissions to users, not other moderators or admins
    if (requestingUser.role === 'moderator' && ['moderator', 'admin'].includes(targetUser.role)) {
      return res.status(403).json({ error: 'Cannot assign permissions to moderators or admins' });
    }

    const oldPermissions = targetUser.permissions || [];
    targetUser.permissions = permissions;
    await targetUser.save();

    // Log the permission assignment
    requestingUser.auditLog.push({
      action: 'user_permissions_updated',
      details: `Updated permissions for user ${userId}. Reason: ${reason || 'Not specified'}`,
      timestamp: new Date(),
    });
    await requestingUser.save();

    // Send notification to target user
    await notificationService.createNotification({
      recipient: userId,
      type: 'system',
      title: 'Permissions Updated',
      message: 'Your permissions have been updated',
      data: {
        oldPermissions,
        newPermissions: permissions,
      },
      channels: {
        inApp: true,
        push: targetUser.pushNotifications,
      },
    });

    res.json({
      message: 'User permissions updated successfully',
      oldPermissions,
      newPermissions: permissions,
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    res.status(500).json({ error: 'Failed to update user permissions' });
  }
});

// Get user's current role and permissions
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('role permissions');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      role: user.role,
      permissions: user.permissions || [],
      canModerate: ['admin', 'moderator'].includes(user.role),
      canManageUsers: user.role === 'admin',
    });
  } catch (error) {
    console.error('Error fetching user role:', error);
    res.status(500).json({ error: 'Failed to fetch user role' });
  }
});

// Get available permissions list
router.get('/permissions/list', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const allPermissions = [
      // User management permissions
      'manage_users',
      'view_user_profiles',
      'ban_users',
      'unban_users',
      
      // Content moderation permissions
      'moderate_content',
      'delete_messages',
      'edit_messages',
      'view_audit_logs',
      
      // Group/room management permissions
      'manage_groups',
      'manage_rooms',
      'create_groups',
      'create_rooms',
      
      // Analytics permissions
      'view_analytics',
      'export_data',
      
      // System permissions
      'manage_permissions',
      'manage_achievements',
      'send_announcements',
      
      // Communication permissions
      'send_global_messages',
      'override_privacy',
    ];

    // Filter permissions based on user role
    let availablePermissions = [];
    
    if (user.role === 'admin') {
      availablePermissions = allPermissions;
    } else if (user.role === 'moderator') {
      availablePermissions = allPermissions.filter(p => 
        !['manage_users', 'manage_permissions', 'send_global_messages', 'override_privacy'].includes(p)
      );
    } else {
      availablePermissions = [];
    }

    res.json({
      permissions: availablePermissions,
      userPermissions: user.permissions || [],
    });
  } catch (error) {
    console.error('Error fetching permissions list:', error);
    res.status(500).json({ error: 'Failed to fetch permissions list' });
  }
});

// Get role statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const requestingUserId = req.user.id;

    // Check if user is admin or moderator
    const requestingUser = await User.findById(requestingUserId);
    if (!requestingUser || !['admin', 'moderator'].includes(requestingUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const stats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ 
      onlineStatus: { $in: ['online', 'away'] },
      lastSeen: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    const bannedUsers = await User.countDocuments({ isBanned: true });

    res.json({
      roleDistribution: stats,
      totalUsers,
      activeUsers,
      bannedUsers,
      userRoles: {
        user: stats.find(s => s._id === 'user')?.count || 0,
        moderator: stats.find(s => s._id === 'moderator')?.count || 0,
        admin: stats.find(s => s._id === 'admin')?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching role statistics:', error);
    res.status(500).json({ error: 'Failed to fetch role statistics' });
  }
});

// Ban user (admin/moderator only)
router.post('/:userId/ban', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason, duration } = req.body; // duration in days, 0 = permanent
    const adminUserId = req.user.id;

    // Check if requester is admin or moderator
    const requestingUser = await User.findById(adminUserId);
    if (!requestingUser || !['admin', 'moderator'].includes(requestingUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot ban admin users
    if (targetUser.role === 'admin') {
      return res.status(403).json({ error: 'Cannot ban admin users' });
    }

    // Moderators cannot ban other moderators
    if (requestingUser.role === 'moderator' && targetUser.role === 'moderator') {
      return res.status(403).json({ error: 'Cannot ban other moderators' });
    }

    targetUser.isBanned = true;
    targetUser.banReason = reason || 'No reason provided';
    
    if (duration > 0) {
      targetUser.banExpires = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);
    }

    await targetUser.save();

    // Log the ban
    requestingUser.auditLog.push({
      action: 'user_banned',
      details: `Banned user ${userId}. Reason: ${reason}. Duration: ${duration || 'permanent'} days`,
      timestamp: new Date(),
    });
    await requestingUser.save();

    // Send notification to banned user
    await notificationService.createNotification({
      recipient: userId,
      type: 'system',
      title: 'Account Banned',
      message: `Your account has been banned. Reason: ${reason || 'No reason provided'}`,
      data: {
        bannedBy: adminUserId,
        banExpires: targetUser.banExpires,
      },
      channels: {
        inApp: true,
      },
    });

    res.json({
      message: 'User banned successfully',
      banExpires: targetUser.banExpires,
    });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Unban user (admin only)
router.post('/:userId/unban', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user.id;

    // Check if requester is admin
    const requestingUser = await User.findById(adminUserId);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!targetUser.isBanned) {
      return res.status(400).json({ error: 'User is not banned' });
    }

    targetUser.isBanned = false;
    targetUser.banReason = '';
    targetUser.banExpires = null;

    await targetUser.save();

    // Log the unban
    requestingUser.auditLog.push({
      action: 'user_unbanned',
      details: `Unbanned user ${userId}. Reason: ${reason || 'No reason provided'}`,
      timestamp: new Date(),
    });
    await requestingUser.save();

    // Send notification to unbanned user
    await notificationService.createNotification({
      recipient: userId,
      type: 'system',
      title: 'Account Unbanned',
      message: 'Your account has been unbanned. You can now access the platform.',
      data: {
        unbannedBy: adminUserId,
      },
      channels: {
        inApp: true,
        push: targetUser.pushNotifications,
      },
    });

    res.json({
      message: 'User unbanned successfully',
    });
  } catch (error) {
    console.error('Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

export { router as rolesRouter };
