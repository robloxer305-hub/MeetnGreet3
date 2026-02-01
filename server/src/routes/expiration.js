import express from 'express';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for setting message expiration
const expirationSchema = z.object({
  messageId: z.string(),
  expiresIn: z.number().min(1).max(8760), // hours (1 hour to 1 year)
});

// Set expiration for a specific message
router.post('/set-expiration', requireAuth, async (req, res) => {
  try {
    const { messageId, expiresIn } = expirationSchema.parse(req.body);
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user owns the message or is admin/moderator
    const user = await User.findById(userId);
    const isOwner = message.from.toString() === userId;
    const canModerate = ['admin', 'moderator'].includes(user.role);

    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Set expiration time
    message.expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
    message.isExpired = false;

    await message.save();

    // Log the action
    user.auditLog.push({
      action: 'message_expiration_set',
      details: `Set expiration for message ${messageId} to expire in ${expiresIn} hours`,
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: 'Message expiration set successfully',
      expiresAt: message.expiresAt,
    });
  } catch (error) {
    console.error('Error setting message expiration:', error);
    res.status(500).json({ error: 'Failed to set message expiration' });
  }
});

// Remove expiration from a message
router.post('/remove-expiration', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.body;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user owns the message or is admin/moderator
    const user = await User.findById(userId);
    const isOwner = message.from.toString() === userId;
    const canModerate = ['admin', 'moderator'].includes(user.role);

    if (!isOwner && !canModerate) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Remove expiration
    message.expiresAt = null;
    message.isExpired = false;

    await message.save();

    res.json({
      message: 'Message expiration removed successfully',
    });
  } catch (error) {
    console.error('Error removing message expiration:', error);
    res.status(500).json({ error: 'Failed to remove message expiration' });
  }
});

// Get messages that will expire soon
router.get('/expiring-soon', requireAuth, async (req, res) => {
  try {
    const { hours = 24 } = req.query; // Default to messages expiring in next 24 hours
    const userId = req.user.id;

    const cutoffTime = new Date(Date.now() + parseInt(hours) * 60 * 60 * 1000);

    const messages = await Message.find({
      from: userId,
      expiresAt: { $exists: true, $lte: cutoffTime },
      isExpired: false,
      isDeleted: false,
    })
    .populate('to', 'displayName avatarUrl')
    .sort({ expiresAt: 1 })
    .limit(50);

    res.json({
      messages,
      count: messages.length,
    });
  } catch (error) {
    console.error('Error fetching expiring messages:', error);
    res.status(500).json({ error: 'Failed to fetch expiring messages' });
  }
});

// Get expired messages (for cleanup or admin)
router.get('/expired', requireAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const messages = await Message.find({
      expiresAt: { $exists: true, $lte: new Date() },
      isExpired: false,
    })
    .populate('from', 'displayName avatarUrl')
    .populate('to', 'displayName avatarUrl')
    .sort({ expiresAt: 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

    const total = await Message.countDocuments({
      expiresAt: { $exists: true, $lte: new Date() },
      isExpired: false,
    });

    res.json({
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching expired messages:', error);
    res.status(500).json({ error: 'Failed to fetch expired messages' });
  }
});

// Mark expired messages (cleanup job)
router.post('/mark-expired', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Find all messages that should be expired
    const result = await Message.updateMany(
      {
        expiresAt: { $exists: true, $lte: new Date() },
        isExpired: false,
      },
      { isExpired: true }
    );

    res.json({
      message: 'Expired messages marked successfully',
      markedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('Error marking expired messages:', error);
    res.status(500).json({ error: 'Failed to mark expired messages' });
  }
});

// Delete expired messages (cleanup job)
router.post('/delete-expired', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Find and delete expired messages
    const result = await Message.deleteMany({
      isExpired: true,
    });

    res.json({
      message: 'Expired messages deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error('Error deleting expired messages:', error);
    res.status(500).json({ error: 'Failed to delete expired messages' });
  }
});

// Get expiration statistics
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const stats = await Message.aggregate([
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          messagesWithExpiration: {
            $sum: { $cond: [{ $exists: ['$expiresAt', true] }, 1, 0] }
          },
          expiredMessages: {
            $sum: { $cond: [{ $eq: ['$isExpired', true] }, 1, 0] }
          },
          expiringIn24Hours: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $exists: ['$expiresAt', true] },
                    { $lte: ['$expiresAt', new Date(Date.now() + 24 * 60 * 60 * 1000)] },
                    { $gt: ['$expiresAt', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
          expiringIn7Days: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $exists: ['$expiresAt', true] },
                    { $lte: ['$expiresAt', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)] },
                    { $gt: ['$expiresAt', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          },
        },
      },
    ]);

    res.json({
      stats: stats[0] || {
        totalMessages: 0,
        messagesWithExpiration: 0,
        expiredMessages: 0,
        expiringIn24Hours: 0,
        expiringIn7Days: 0,
      },
    });
  } catch (error) {
    console.error('Error fetching expiration stats:', error);
    res.status(500).json({ error: 'Failed to fetch expiration stats' });
  }
});

// Auto-delete messages based on user settings
router.post('/auto-delete', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.autoDeleteMessages || user.messageExpiration === 0) {
      return res.status(400).json({ error: 'Auto-delete is not enabled for this user' });
    }

    // Find user's messages older than the expiration period
    const cutoffTime = new Date(Date.now() - user.messageExpiration * 60 * 60 * 1000);

    const result = await Message.deleteMany({
      from: userId,
      createdAt: { $lte: cutoffTime },
      isDeleted: false,
    });

    // Log the auto-delete action
    user.auditLog.push({
      action: 'auto_delete_messages',
      details: `Auto-deleted ${result.deletedCount} messages older than ${user.messageExpiration} hours`,
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: 'Auto-delete completed successfully',
      deletedCount: result.deletedCount,
      expirationHours: user.messageExpiration,
    });
  } catch (error) {
    console.error('Error auto-deleting messages:', error);
    res.status(500).json({ error: 'Failed to auto-delete messages' });
  }
});

export { router as expirationRouter };
