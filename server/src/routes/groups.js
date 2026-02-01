import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Group } from '../models/Group.js';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// Schema for creating groups
const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean().default(false),
  inviteOnly: z.boolean().default(false),
  approvalRequired: z.boolean().default(false),
  category: z.enum(['general', 'gaming', 'tech', 'music', 'art', 'sports', 'education', 'business', 'entertainment', 'other']).default('general'),
  tags: z.array(z.string()).default([]),
  allowFileSharing: z.boolean().default(true),
  allowVoiceChannels: z.boolean().default(false),
  allowVideoCalls: z.boolean().default(false),
  allowPolls: z.boolean().default(true),
  allowReactions: z.boolean().default(true),
});

// Schema for updating groups
const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  avatarUrl: z.string().optional(),
  isPrivate: z.boolean().optional(),
  inviteOnly: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  category: z.enum(['general', 'gaming', 'tech', 'music', 'art', 'sports', 'education', 'business', 'entertainment', 'other']).optional(),
  tags: z.array(z.string()).optional(),
  topic: z.string().optional(),
  allowFileSharing: z.boolean().optional(),
  allowVoiceChannels: z.boolean().optional(),
  allowVideoCalls: z.boolean().optional(),
  allowPolls: z.boolean().optional(),
  allowReactions: z.boolean().optional(),
  messageRetentionDays: z.number().optional(),
  maxFileSize: z.number().optional(),
  allowInvites: z.boolean().optional(),
  requireApprovalToJoin: z.boolean().optional(),
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Groups router is working!' });
});

// Upload group avatar
router.post('/:groupId/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    console.log('🖼️ Avatar upload request:', { groupId, userId });
    console.log('📁 File info:', req.file);

    const group = await Group.findById(groupId);
    if (!group) {
      console.log('❌ Group not found:', groupId);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log('📋 Found group for avatar upload:', group.name);
    console.log('👤 Group creator:', group.creator);
    console.log('👥 Group admins:', group.admins);

    // Check if user is admin or creator
    const isCreator = group.creator.toString() === userId;
    const isAdmin = group.admins?.some(admin => admin.toString() === userId) ||
                   group.members?.some(m => m.user.toString() === userId && m.role === 'admin');
    
    console.log('🔐 Avatar upload permission check:', { userId, isCreator, isAdmin });
    
    if (!isCreator && !isAdmin) {
      console.log('❌ Avatar upload permission denied for user:', userId);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📸 Processing file:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      bufferLength: req.file.buffer?.length
    });

    // Convert buffer to base64
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;
    const avatarUrl = `data:${mimeType};base64,${base64Image}`;

    console.log('🔗 Generated avatar URL length:', avatarUrl.length);

    // Update group avatar
    group.avatarUrl = avatarUrl;
    await group.save();

    console.log('✅ Avatar uploaded successfully for group:', group.name);

    res.json({
      message: 'Avatar uploaded successfully',
      avatarUrl,
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size too large. Maximum size is 5MB.' });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files uploaded.' });
    }
    if (error.message === 'Only image files are allowed') {
      return res.status(400).json({ error: 'Only image files are allowed.' });
    }
    res.status(500).json({ error: 'Failed to upload avatar', details: error.message });
  }
});

// Generate group invite
router.post('/:groupId/invite', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const { maxUses = 0, expiresInDays = 7 } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin or creator
    const isCreator = group.creator.toString() === userId;
    const isAdmin = group.admins?.some(admin => admin.toString() === userId) ||
                   group.members?.some(m => m.user.toString() === userId && m.role === 'admin');
    
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Generate unique invite code
    const inviteCode = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const invite = {
      code: inviteCode,
      createdBy: userId,
      expiresAt,
      maxUses,
      uses: 0,
      isActive: true,
    };

    group.invites.push(invite);
    await group.save();

    const inviteLink = `${process.env.CLIENT_ORIGIN || 'http://localhost:5173'}/groups/join/${inviteCode}`;

    res.json({
      message: 'Invite created successfully',
      inviteCode,
      inviteLink,
      expiresAt,
      maxUses,
    });
  } catch (error) {
    console.error('Error creating invite:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Join group via invite code
router.post('/join/:inviteCode', requireAuth, async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const userId = req.user.id;

    console.log('🎯 Join group via invite:', { inviteCode, userId });

    // Find group with this invite code
    const group = await Group.findOne({ 'invites.code': inviteCode });
    if (!group) {
      console.log('❌ Group not found for invite code:', inviteCode);
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    console.log('📋 Found group for invite:', group.name);

    // Find the specific invite
    const invite = group.invites.find(inv => inv.code === inviteCode);
    if (!invite || !invite.isActive) {
      console.log('❌ Invite not found or inactive:', { inviteCode, isActive: invite?.isActive });
      return res.status(400).json({ error: 'Invite is no longer active' });
    }

    console.log('✅ Found invite:', { code: invite.code, isActive: invite.isActive, expiresAt: invite.expiresAt });

    // Check if invite has expired
    if (invite.expiresAt && new Date() > invite.expiresAt) {
      console.log('❌ Invite expired:', invite.expiresAt);
      return res.status(400).json({ error: 'Invite has expired' });
    }

    // Check if invite has reached max uses
    if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
      return res.status(400).json({ error: 'Invite has reached maximum uses' });
    }

    // Check if user is already a member
    if (group.members.some(m => m.user.toString() === userId)) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Check if user is banned
    if (group.bannedUsers.includes(userId)) {
      return res.status(403).json({ error: 'You are banned from this group' });
    }

    // Add user to group
    group.members.push({
      user: userId,
      joinedAt: new Date(),
      role: 'member',
    });
    group.memberCount += 1;
    group.lastActivity = new Date();

    // Increment invite usage
    invite.uses += 1;

    await group.save();

    // Add group to user's groups
    await User.findByIdAndUpdate(userId, {
      $push: { groups: group._id },
    });

    await group.populate('creator', 'displayName avatarUrl');
    await group.populate('members.user', 'displayName avatarUrl');

    res.json({
      message: 'Joined group successfully',
      group,
    });
  } catch (error) {
    console.error('Error joining group via invite:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Get group invites (for admins)
router.get('/:groupId/invites', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    console.log('🔍 Fetching invites for group:', groupId, 'by user:', userId);

    const group = await Group.findById(groupId).populate('invites.createdBy', 'displayName avatarUrl');
    if (!group) {
      console.log('❌ Group not found:', groupId);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log('📋 Found group:', group.name);
    console.log('👤 Group creator:', group.creator);
    console.log('👥 Group admins:', group.admins);

    // Check if user is admin or creator
    const isCreator = group.creator.toString() === userId;
    const isAdmin = group.admins?.some(admin => admin.toString() === userId) ||
                   group.members?.some(m => m.user.toString() === userId && m.role === 'admin');
    
    console.log('🔐 Permission check:', { userId, isCreator, isAdmin });
    
    if (!isCreator && !isAdmin) {
      console.log('❌ Permission denied for user:', userId);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Filter out expired and inactive invites
    const activeInvites = group.invites.filter(invite => {
      return invite.isActive && (!invite.expiresAt || new Date() <= invite.expiresAt);
    });

    console.log('✅ Returning invites:', activeInvites.length);

    res.json({
      invites: activeInvites,
    });
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Revoke invite
router.delete('/:groupId/invites/:inviteCode', requireAuth, async (req, res) => {
  try {
    const { groupId, inviteCode } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin or creator
    const isCreator = group.creator.toString() === userId;
    const isAdmin = group.admins?.some(admin => admin.toString() === userId) ||
                   group.members?.some(m => m.user.toString() === userId && m.role === 'admin');
    
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Find and deactivate the invite
    const invite = group.invites.find(inv => inv.code === inviteCode);
    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    invite.isActive = false;
    await group.save();

    res.json({
      message: 'Invite revoked successfully',
    });
  } catch (error) {
    console.error('Error revoking invite:', error);
    res.status(500).json({ error: 'Failed to revoke invite' });
  }
});

// Create a new group
router.post('/', requireAuth, async (req, res) => {
  try {
    console.log('Group creation request:', req.body);
    console.log('User ID:', req.user.id);
    
    const groupData = createGroupSchema.parse(req.body);
    console.log('Parsed group data:', groupData);
    
    const userId = req.user.id;

    const group = new Group({
      ...groupData,
      creator: userId,
      admins: [userId],
      members: [{
        user: userId,
        joinedAt: new Date(),
        role: 'admin',
      }],
      memberCount: 1,
      invites: [], // Explicitly set empty invites array
    });

    console.log('Group object before save:', group);
    await group.save();
    console.log('Group saved successfully');

    // Add group to user's groups
    await User.findByIdAndUpdate(userId, {
      $push: { groups: group._id },
    });
    console.log('Group added to user');

    // Populate group data for response
    await group.populate('creator', 'displayName avatarUrl');
    await group.populate('members.user', 'displayName avatarUrl');

    res.status(201).json({
      message: 'Group created successfully',
      group,
    });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group', details: error.message });
  }
});

// Get all groups (with filtering)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      tags,
      search,
      isPublic,
      userId,
    } = req.query;

    let query = {};

    // Filter by visibility
    if (isPublic !== undefined) {
      query.isPrivate = isPublic === 'false';
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by tags
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    // Search by name or description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter by user membership
    if (userId) {
      query['members.user'] = userId;
    }

    const groups = await Group.find(query)
      .populate('creator', 'displayName avatarUrl')
      .populate('members.user', 'displayName avatarUrl')
      .sort({ lastActivity: -1, memberCount: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Group.countDocuments(query);

    res.json({
      groups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get group by ID
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId)
      .populate('creator', 'displayName avatarUrl')
      .populate('admins', 'displayName avatarUrl')
      .populate('members.user', 'displayName avatarUrl');

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user can view this group
    const userId = req.user?.id;
    if (group.isPrivate && !group.members.some(m => m.user.toString() === userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ group });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Update group
router.patch('/:groupId', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const updates = updateGroupSchema.parse(req.body);
    const userId = req.user.id;

    console.log('🔧 Group update request:', { groupId, userId, updates });

    const group = await Group.findById(groupId);
    if (!group) {
      console.log('❌ Group not found:', groupId);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log('📋 Found group:', group.name);
    console.log('👤 Group creator:', group.creator);
    console.log('👥 Group admins:', group.admins);
    console.log('🔍 Group members:', group.members.map(m => ({ user: m.user, role: m.role })));

    // Check if user is admin or creator
    const isCreator = group.creator.toString() === userId;
    const isAdmin = group.admins?.some(admin => admin.toString() === userId) ||
                   group.members?.some(m => m.user.toString() === userId && m.role === 'admin');
    
    console.log('🔐 Permission check:', { userId, isCreator, isAdmin });
    
    if (!isCreator && !isAdmin) {
      console.log('❌ Permission denied for user:', userId);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Update group
    Object.assign(group, updates);
    await group.save();

    console.log('✅ Group updated successfully:', group.name);

    await group.populate('creator', 'displayName avatarUrl');
    await group.populate('members.user', 'displayName avatarUrl');

    res.json({
      message: 'Group updated successfully',
      group,
    });
  } catch (error) {
    console.error('Error updating group:', error);
    if (error.name === 'ZodError') {
      console.error('Validation errors:', error.errors);
      return res.status(400).json({ 
        error: 'Invalid input data', 
        details: error.errors 
      });
    }
    res.status(500).json({ error: 'Failed to update group', details: error.message });
  }
});

// Join group
router.post('/:groupId/join', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is already a member
    if (group.members.some(m => m.user.toString() === userId)) {
      return res.status(400).json({ error: 'Already a member' });
    }

    // Check if user is banned
    if (group.bannedUsers.includes(userId)) {
      return res.status(403).json({ error: 'You are banned from this group' });
    }

    // Handle approval requirement
    if (group.approvalRequired) {
      // Create join request (would need a separate model for this)
      return res.json({
        message: 'Join request submitted for approval',
        status: 'pending',
      });
    }

    // Add user to group
    group.members.push({
      user: userId,
      joinedAt: new Date(),
      role: 'member',
    });
    group.memberCount += 1;
    group.lastActivity = new Date();

    await group.save();

    // Add group to user's groups
    await User.findByIdAndUpdate(userId, {
      $push: { groups: groupId },
    });

    await group.populate('members.user', 'displayName avatarUrl');

    res.json({
      message: 'Joined group successfully',
      group,
    });
  } catch (error) {
    console.error('Error joining group:', error);
    res.status(500).json({ error: 'Failed to join group' });
  }
});

// Leave group
router.post('/:groupId/leave', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is a member
    const memberIndex = group.members.findIndex(m => m.user.toString() === userId);
    if (memberIndex === -1) {
      return res.status(400).json({ error: 'Not a member of this group' });
    }

    // Remove user from group
    group.members.splice(memberIndex, 1);
    group.memberCount -= 1;
    group.lastActivity = new Date();

    await group.save();

    // Remove group from user's groups
    await User.findByIdAndUpdate(userId, {
      $pull: { groups: groupId },
    });

    await group.populate('members.user', 'displayName avatarUrl');

    res.json({
      message: 'Left group successfully',
      group,
    });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// Remove member from group (admin only)
router.delete('/:groupId/members/:memberId', requireAuth, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is admin or creator
    const member = group.members.find(m => m.user.toString() === userId);
    if (!member || !['admin', 'creator'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if target member exists
    const targetMemberIndex = group.members.findIndex(m => m.user.toString() === memberId);
    if (targetMemberIndex === -1) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Cannot remove creator
    if (group.creator.toString() === memberId) {
      return res.status(400).json({ error: 'Cannot remove group creator' });
    }

    // Remove member
    group.members.splice(targetMemberIndex, 1);
    group.memberCount -= 1;
    group.lastActivity = new Date();

    await group.save();

    // Remove group from user's groups
    await User.findByIdAndUpdate(memberId, {
      $pull: { groups: groupId },
    });

    res.json({
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Promote member to admin
router.patch('/:groupId/members/:memberId/promote', requireAuth, async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is creator or admin
    const member = group.members.find(m => m.user.toString() === userId);
    if (!member || !['admin', 'creator'].includes(member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Find target member
    const targetMember = group.members.find(m => m.user.toString() === memberId);
    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Promote to admin
    targetMember.role = 'admin';
    await group.save();

    // Add to admins array
    if (!group.admins.includes(memberId)) {
      group.admins.push(memberId);
      await group.save();
    }

    res.json({
      message: 'Member promoted to admin successfully',
    });
  } catch (error) {
    console.error('Error promoting member:', error);
    res.status(500).json({ error: 'Failed to promote member' });
  }
});

// Get group messages
router.get('/:groupId/messages', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.some(m => m.user.toString() === userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({
      groupId,
      isDeleted: false,
    })
    .populate('from', 'displayName avatarUrl')
    .populate('replyTo', 'from text createdAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

    const total = await Message.countDocuments({
      groupId,
      isDeleted: false,
    });

    res.json({
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching group messages:', error);
    res.status(500).json({ error: 'Failed to fetch group messages' });
  }
});

// Send message to group
router.post('/:groupId/messages', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content, type = 'message' } = req.body;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is a member
    if (!group.members.some(m => m.user.toString() === userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create message
    const message = new Message({
      kind: 'group',
      groupId,
      from: userId,
      text: content,
      contentType: 'text',
    });

    await message.save();

    // Update group activity
    group.lastActivity = new Date();
    group.messageCount += 1;
    await group.save();

    // Populate message data
    await message.populate('from', 'displayName avatarUrl');

    res.status(201).json({
      message: 'Message sent successfully',
      message,
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Delete group (disband)
router.delete('/:groupId', requireAuth, async (req, res) => {
  try {
    console.log('Disband group request:', req.params.groupId);
    console.log('User ID:', req.user.id);
    
    const { groupId } = req.params;
    const userId = req.user.id;

    const group = await Group.findById(groupId);
    console.log('Found group:', group);
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Check if user is the creator
    console.log('Group creator:', group.creator);
    console.log('User ID:', userId);
    console.log('Is creator?', group.creator.toString() === userId);
    
    if (group.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Only group creator can disband the group' });
    }

    console.log('Deleting all messages in group...');
    // Delete all messages in the group
    await Message.deleteMany({ groupId });
    console.log('Messages deleted');

    console.log('Removing group from all users...');
    // Remove group from all users' groups arrays
    await User.updateMany(
      { groups: groupId },
      { $pull: { groups: groupId } }
    );
    console.log('Group removed from users');

    console.log('Deleting group document...');
    // Delete the group
    await Group.findByIdAndDelete(groupId);
    console.log('Group deleted');

    res.json({
      message: 'Group disbanded successfully',
    });
  } catch (error) {
    console.error('Error disbanding group:', error);
    res.status(500).json({ error: 'Failed to disband group', details: error.message });
  }
});

export { router as groupsRouter };
