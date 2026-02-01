import express from 'express';
import { z } from 'zod';
import { Room } from '../models/Room.js';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';
import { requireAuth } from '../middleware/requireAuth.js';
import mongoose from 'mongoose';

const router = express.Router();

// Schema for creating rooms
const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
  isTemporary: z.boolean().default(false),
  maxUsers: z.number().min(2).max(1000).default(100),
  category: z.enum(['general', 'gaming', 'tech', 'music', 'art', 'sports', 'education', 'business', 'entertainment', 'random', 'adult']).default('general'),
  tags: z.array(z.string()).default([]),
  topic: z.string().optional(),
  allowFileSharing: z.boolean().default(true),
  allowVoiceChat: z.boolean().default(false),
  allowVideoChat: z.boolean().default(false),
  allowReactions: z.boolean().default(true),
  allowPolls: z.boolean().default(true),
  slowMode: z.number().min(0).max(300).default(0), // seconds between messages
  welcomeMessage: z.string().optional(),
  password: z.string().optional(),
});

// Schema for updating rooms
const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
  maxUsers: z.number().min(2).max(1000).optional(),
  category: z.enum(['general', 'gaming', 'tech', 'music', 'art', 'sports', 'education', 'business', 'entertainment', 'random', 'adult']).optional(),
  tags: z.array(z.string()).optional(),
  topic: z.string().optional(),
  allowFileSharing: z.boolean().optional(),
  allowVoiceChat: z.boolean().optional(),
  allowVideoChat: z.boolean().optional(),
  allowReactions: z.boolean().optional(),
  allowPolls: z.boolean().optional(),
  slowMode: z.number().min(0).max(300).optional(),
  welcomeMessage: z.string().optional(),
  password: z.string().optional(),
  isLocked: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  autoModeration: z.boolean().optional(),
});

// Create a new room
router.post('/', requireAuth, async (req, res) => {
  try {
    const roomData = createRoomSchema.parse(req.body);
    const userId = req.user.id;

    const room = new Room({
      ...roomData,
      creator: userId,
      moderators: [userId],
      currentUsers: [userId],
      hasPassword: !!roomData.password,
      lastActivity: new Date(),
    });

    await room.save();

    // Add room to user's current room
    await User.findByIdAndUpdate(userId, {
      currentRoom: room._id,
    });

    // Populate room data for response
    await room.populate('creator', 'displayName avatarUrl');
    await room.populate('moderators', 'displayName avatarUrl');
    await room.populate('currentUsers', 'displayName avatarUrl');

    res.status(201).json({
      message: 'Room created successfully',
      room,
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Get all rooms (with filtering)
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      tags,
      search,
      isPublic,
      includeEmpty,
    } = req.query;

    let query = {};

    // Filter by visibility
    if (isPublic !== undefined) {
      query.isPublic = isPublic === 'true';
    } else {
      // Default to public rooms only for unauthenticated users
      if (!req.user) {
        query.isPublic = true;
      }
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

    // Search by name, description, or topic
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } },
      ];
    }

    // Filter out archived rooms
    query.isArchived = { $ne: true };

    // Filter out expired rooms
    query.isExpired = { $ne: true };

    // Include/exclude empty rooms
    if (includeEmpty === 'false') {
      query.currentUsers = { $gt: [] };
    }

    const rooms = await Room.find(query)
      .populate('creator', 'displayName avatarUrl')
      .populate('moderators', 'displayName avatarUrl')
      .sort({ currentUsers: -1, lastActivity: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Room.countDocuments(query);

    res.json({
      rooms,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get room by ID
router.get('/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId)
      .populate('creator', 'displayName avatarUrl')
      .populate('moderators', 'displayName avatarUrl')
      .populate('currentUsers', 'displayName avatarUrl');

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user can view this room
    const userId = req.user?.id;
    if (room.isPrivate && !room.currentUsers.some(u => u.toString() === userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ room });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Join a room
router.post('/:roomId/join', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { password } = req.body;
    const userId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if room is locked or archived
    if (room.isLocked) {
      return res.status(403).json({ error: 'Room is locked' });
    }

    if (room.isArchived) {
      return res.status(403).json({ error: 'Room is archived' });
    }

    if (room.isExpired) {
      return res.status(403).json({ error: 'Room has expired' });
    }

    // Check if user is already in room
    if (room.currentUsers.includes(userId)) {
      return res.status(400).json({ error: 'Already in room' });
    }

    // Check if user is banned
    if (room.bannedUsers.includes(userId)) {
      return res.status(403).json({ error: 'You are banned from this room' });
    }

    // Check room capacity
    if (room.currentUsers.length >= room.maxUsers) {
      return res.status(403).json({ error: 'Room is full' });
    }

    // Check password if required
    if (room.hasPassword && room.password !== password) {
      return res.status(403).json({ error: 'Invalid password' });
    }

    // Add user to room
    room.currentUsers.push(userId);
    room.lastActivity = new Date();
    
    // Update peak users if needed
    if (room.currentUsers.length > room.peakUsers) {
      room.peakUsers = room.currentUsers.length;
    }

    await room.save();

    // Update user's current room
    await User.findByIdAndUpdate(userId, {
      currentRoom: roomId,
    });

    // Emit socket event
    req.io.to(`room:${roomId}`).emit('room:user_joined', {
      roomId,
      userId,
      currentUsers: room.currentUsers,
    });

    await room.populate('currentUsers', 'displayName avatarUrl');

    res.json({
      message: 'Joined room successfully',
      room,
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Failed to join room' });
  }
});

// Leave a room
router.post('/:roomId/leave', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is in room
    if (!room.currentUsers.includes(userId)) {
      return res.status(400).json({ error: 'Not in room' });
    }

    // Remove user from room
    room.currentUsers.pull(userId);
    room.lastActivity = new Date();

    await room.save();

    // Update user's current room
    await User.findByIdAndUpdate(userId, {
      currentRoom: '',
    });

    // Emit socket event
    req.io.to(`room:${roomId}`).emit('room:user_left', {
      roomId,
      userId,
      currentUsers: room.currentUsers,
    });

    res.json({
      message: 'Left room successfully',
    });
  } catch (error) {
    console.error('Error leaving room:', error);
    res.status(500).json({ error: 'Failed to leave room' });
  }
});

// Update room (moderator/creator only)
router.patch('/:roomId', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const updates = updateRoomSchema.parse(req.body);
    const userId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is moderator or creator
    if (!room.moderators.includes(userId) && room.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Update password flag if password is provided
    if (updates.password !== undefined) {
      updates.hasPassword = !!updates.password;
    }

    // Update room
    Object.assign(room, updates);
    room.lastActivity = new Date();
    await room.save();

    await room.populate('creator', 'displayName avatarUrl');
    await room.populate('moderators', 'displayName avatarUrl');
    await room.populate('currentUsers', 'displayName avatarUrl');

    // Emit socket event for room updates
    req.io.to(`room:${roomId}`).emit('room:updated', {
      roomId,
      updates,
    });

    res.json({
      message: 'Room updated successfully',
      room,
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Kick user from room (moderator/creator only)
router.post('/:roomId/kick/:userId', requireAuth, async (req, res) => {
  try {
    const { roomId, userId: targetUserId } = req.params;
    const userId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is moderator or creator
    if (!room.moderators.includes(userId) && room.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Check if target user is in room
    if (!room.currentUsers.includes(targetUserId)) {
      return res.status(404).json({ error: 'User not in room' });
    }

    // Cannot kick creator
    if (room.creator.toString() === targetUserId) {
      return res.status(400).json({ error: 'Cannot kick room creator' });
    }

    // Remove user from room
    room.currentUsers.pull(targetUserId);
    room.lastActivity = new Date();

    await room.save();

    // Update target user's current room
    await User.findByIdAndUpdate(targetUserId, {
      currentRoom: '',
    });

    // Emit socket events
    req.io.to(`room:${roomId}`).emit('room:user_kicked', {
      roomId,
      userId: targetUserId,
      kickedBy: userId,
    });

    req.io.to(targetUserId).emit('room:kicked', {
      roomId,
      reason: 'Kicked by moderator',
    });

    res.json({
      message: 'User kicked successfully',
    });
  } catch (error) {
    console.error('Error kicking user:', error);
    res.status(500).json({ error: 'Failed to kick user' });
  }
});

// Ban user from room (moderator/creator only)
router.post('/:roomId/ban/:userId', requireAuth, async (req, res) => {
  try {
    const { roomId, userId: targetUserId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is moderator or creator
    if (!room.moderators.includes(userId) && room.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Cannot ban creator
    if (room.creator.toString() === targetUserId) {
      return res.status(400).json({ error: 'Cannot ban room creator' });
    }

    // Add to banned users
    if (!room.bannedUsers.includes(targetUserId)) {
      room.bannedUsers.push(targetUserId);
    }

    // Remove from room if currently in it
    if (room.currentUsers.includes(targetUserId)) {
      room.currentUsers.pull(targetUserId);
      
      // Update target user's current room
      await User.findByIdAndUpdate(targetUserId, {
        currentRoom: '',
      });
    }

    room.lastActivity = new Date();
    await room.save();

    // Emit socket events
    req.io.to(`room:${roomId}`).emit('room:user_banned', {
      roomId,
      userId: targetUserId,
      bannedBy: userId,
      reason,
    });

    req.io.to(targetUserId).emit('room:banned', {
      roomId,
      reason: reason || 'Banned by moderator',
    });

    res.json({
      message: 'User banned successfully',
    });
  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

// Get room messages
router.get('/:roomId/messages', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const userId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is in room
    if (!room.currentUsers.includes(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await Message.find({
      roomId,
      kind: 'public',
      isDeleted: false,
    })
    .populate('from', 'displayName avatarUrl')
    .populate('replyTo', 'from text createdAt')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

    const total = await Message.countDocuments({
      roomId,
      kind: 'public',
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
    console.error('Error fetching room messages:', error);
    res.status(500).json({ error: 'Failed to fetch room messages' });
  }
});

// Get room categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = [
      { value: 'general', label: 'General', description: 'General discussion' },
      { value: 'gaming', label: 'Gaming', description: 'Video games and gaming culture' },
      { value: 'tech', label: 'Technology', description: 'Technology and programming' },
      { value: 'music', label: 'Music', description: 'Music discussion and sharing' },
      { value: 'art', label: 'Art', description: 'Art and creative works' },
      { value: 'sports', label: 'Sports', description: 'Sports and fitness' },
      { value: 'education', label: 'Education', description: 'Learning and education' },
      { value: 'business', label: 'Business', description: 'Business and entrepreneurship' },
      { value: 'entertainment', label: 'Entertainment', description: 'Movies, TV, and entertainment' },
      { value: 'random', label: 'Random', description: 'Random topics and fun' },
      { value: 'adult', label: 'Adult', description: 'Adult content (18+)' },
    ];

    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get room statistics
router.get('/:roomId/stats', requireAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if user is in room or is moderator/creator
    const isInRoom = room.currentUsers.includes(userId);
    const isModerator = room.moderators.includes(userId) || room.creator.toString() === userId;

    if (!isInRoom && !isModerator) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = {
      currentUsers: room.currentUsers.length,
      peakUsers: room.peakUsers,
      totalMessages: room.totalMessages,
      lastActivity: room.lastActivity,
      createdAt: room.createdAt,
      isLocked: room.isLocked,
      isArchived: room.isArchived,
      isExpired: room.isExpired,
    };

    // Add detailed analytics for moderators
    if (isModerator) {
      const messageStats = await Message.aggregate([
        { $match: { roomId: new mongoose.Types.ObjectId(roomId), isDeleted: false } },
        {
          $group: {
            _id: null,
            totalMessages: { $sum: 1 },
            avgMessagesPerHour: { $avg: 1 },
            topActiveUsers: { $push: '$from' },
          },
        },
      ]);

      stats.analytics = messageStats[0] || {};
    }

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching room stats:', error);
    res.status(500).json({ error: 'Failed to fetch room stats' });
  }
});

export { router as roomsRouter };
