import express from 'express';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for replying to messages
const replySchema = z.object({
  text: z.string().min(1).max(4000),
  contentType: z.enum(['text', 'image', 'video', 'audio', 'file']).default('text'),
  attachments: z.array(z.object({
    type: z.enum(['image', 'video', 'audio', 'file']),
    url: z.string(),
    filename: z.string().default(''),
    size: z.number().default(0),
    mimeType: z.string().default(''),
  })).default([]),
});

// Reply to a message (create thread)
router.post('/:messageId/reply', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text, contentType, attachments } = replySchema.parse(req.body);
    const userId = req.user.id;

    const parentMessage = await Message.findById(messageId);
    if (!parentMessage) {
      return res.status(404).json({ error: 'Parent message not found' });
    }

    // Check if user can reply to this message
    if (!canUserReplyToMessage(userId, parentMessage)) {
      return res.status(403).json({ error: 'Cannot reply to this message' });
    }

    // Determine thread ID (if parent is already a reply, use the same thread)
    const threadId = parentMessage.threadId || parentMessage._id;

    // Create reply message
    const reply = new Message({
      kind: parentMessage.kind,
      roomId: parentMessage.roomId,
      groupId: parentMessage.groupId,
      participants: parentMessage.participants,
      from: userId,
      to: parentMessage.from, // Reply goes to original sender
      text,
      contentType,
      attachments,
      replyTo: parentMessage._id,
      threadId,
    });

    await reply.save();

    // Update parent message to include this reply
    parentMessage.replies.push(reply._id);
    await parentMessage.save();

    // Update thread root message if this is a new thread
    if (!parentMessage.threadId) {
      parentMessage.threadId = parentMessage._id;
      await parentMessage.save();
    }

    // Populate reply with user info
    await reply.populate('from', 'displayName avatarUrl');

    // Emit socket events
    const roomKey = parentMessage.roomId || parentMessage.groupId?.toString();
    
    // Emit to room for real-time updates
    req.io.to(roomKey).emit('message_reply', {
      parentMessageId: messageId,
      reply: reply.toObject(),
      threadId,
    });

    // Emit to specific users for notifications
    if (parentMessage.from.toString() !== userId) {
      req.io.to(parentMessage.from.toString()).emit('message_reply_notification', {
        messageId: reply._id,
        parentMessageId: messageId,
        replyFrom: reply.from,
        text: reply.text,
      });
    }

    res.status(201).json({
      message: 'Reply created successfully',
      reply: reply.toObject(),
      threadId,
    });

  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({ error: 'Failed to create reply' });
  }
});

// Get thread for a message
router.get('/:messageId/thread', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const parentMessage = await Message.findById(messageId);
    if (!parentMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Get thread ID
    const threadId = parentMessage.threadId || parentMessage._id;

    // Get all messages in thread
    const threadMessages = await Message.find({
      $or: [
        { _id: threadId },
        { threadId },
      ],
      isDeleted: false,
    })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('from', 'displayName avatarUrl')
    .populate('replyTo', 'from text createdAt');

    // Get thread statistics
    const totalMessages = await Message.countDocuments({
      $or: [
        { _id: threadId },
        { threadId },
      ],
      isDeleted: false,
    });

    res.json({
      threadMessages,
      threadId,
      parentMessage: parentMessage.toObject(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalMessages,
        pages: Math.ceil(totalMessages / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// Get all threads for a room/group
router.get('/threads/:contextType/:contextId', async (req, res) => {
  try {
    const { contextType, contextId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    let query = { isDeleted: false };

    // Filter by context
    if (contextType === 'room') {
      query.roomId = contextId;
    } else if (contextType === 'group') {
      query.groupId = contextId;
    } else {
      return res.status(400).json({ error: 'Invalid context type' });
    }

    // Get thread root messages (messages that are replies or have replies)
    const threadRoots = await Message.find({
      $and: [
        query,
        {
          $or: [
            { replyTo: { $exists: true } },
            { replies: { $exists: true, $ne: [] } },
          ],
        },
      ],
    })
    .sort({ updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .populate('from', 'displayName avatarUrl')
    .populate('replyTo', 'from text createdAt');

    // Get thread statistics for each root
    const threadsWithStats = await Promise.all(
      threadRoots.map(async (root) => {
        const threadId = root.threadId || root._id;
        const replyCount = await Message.countDocuments({
          threadId,
          isDeleted: false,
          _id: { $ne: threadId },
        });

        const lastReply = await Message.findOne({
          threadId,
          isDeleted: false,
          _id: { $ne: threadId },
        })
        .sort({ createdAt: -1 })
        .populate('from', 'displayName avatarUrl');

        return {
          ...root.toObject(),
          replyCount,
          lastReply,
        };
      })
    );

    const totalThreads = await Message.countDocuments({
      $and: [
        query,
        {
          $or: [
            { replyTo: { $exists: true } },
            { replies: { $exists: true, $ne: [] } },
          ],
        },
      ],
    });

    res.json({
      threads: threadsWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalThreads,
        pages: Math.ceil(totalThreads / limit),
      },
    });

  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// Helper function to check if user can reply to message
function canUserReplyToMessage(userId, message) {
  // Users can reply to public messages
  if (message.kind === 'public') {
    return true;
  }

  // Users can reply to private messages if they are participants
  if (message.kind === 'private') {
    return message.participants.includes(userId);
  }

  // Users can reply to group messages if they are group members
  if (message.kind === 'group') {
    // This would require checking group membership
    return true; // Simplified for now
  }

  return false;
}

export { router as threadingRouter };
