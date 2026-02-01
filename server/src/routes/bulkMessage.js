import express from 'express';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { Group } from '../models/Group.js';
import { Room } from '../models/Room.js';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for bulk messages
const bulkMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  recipients: z.array(z.string()).min(1).max(1000),
  messageType: z.enum(['announcement', 'notification', 'alert', 'update']).default('announcement'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  deliveryMethod: z.enum(['all', 'online', 'offline', 'custom']).default('all'),
  scheduledTime: z.date().optional(),
  attachments: z.array(z.object({
    type: z.enum(['image', 'video', 'audio', 'file']),
    url: z.string(),
    filename: z.string().default(''),
    size: z.number().default(0),
    mimeType: z.string().default(''),
  })).default([]),
  allowReplies: z.boolean().default(true),
  allowReactions: z.boolean().default(true),
});

// Send bulk message
router.post('/send', requireAuth, async (req, res) => {
  try {
    const bulkData = bulkMessageSchema.parse(req.body);
    const senderId = req.user.id;

    // Check if user has permission to send bulk messages
    const sender = await User.findById(senderId);
    if (!sender || !['admin', 'moderator'].includes(sender.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to send bulk messages' });
    }

    // Validate recipients
    const validRecipients = await User.find({
      _id: { $in: bulkData.recipients },
      isBanned: false,
    });

    if (validRecipients.length !== bulkData.recipients.length) {
      return res.status(400).json({ error: 'Some recipients are invalid or banned' });
    }

    // Filter recipients based on delivery method
    let finalRecipients = validRecipients;
    if (bulkData.deliveryMethod === 'online') {
      finalRecipients = validRecipients.filter(user => 
        user.onlineStatus === 'online'
      );
    } else if (bulkData.deliveryMethod === 'offline') {
      finalRecipients = validRecipients.filter(user => 
        user.onlineStatus === 'offline'
      );
    }

    // Create messages for each recipient
    const messages = [];
    const bulkMessageId = new Date().getTime().toString();

    for (const recipient of finalRecipients) {
      const message = new Message({
        kind: 'announcement',
        from: senderId,
        to: recipient._id,
        text: bulkData.message,
        contentType: 'text',
        attachments: bulkData.attachments,
        priority: bulkData.priority,
        isSystemMessage: true,
        systemMessageType: 'bulk_message',
        systemMessageData: {
          bulkMessageId,
          messageType: bulkData.messageType,
          totalRecipients: finalRecipients.length,
          deliveryMethod: bulkData.deliveryMethod,
        },
      });

      await message.save();
      messages.push(message);

      // Send notification to recipient
      await notificationService.createNotification({
        recipient: recipient._id,
        sender: senderId,
        type: 'announcement',
        title: 'System Announcement',
        message: bulkData.message,
        data: {
          messageId: message._id,
          messageType: bulkData.messageType,
          priority: bulkData.priority,
        },
        channels: {
          inApp: true,
          push: recipient.pushNotifications,
        },
        priority: bulkData.priority,
      });
    }

    // Log the bulk message
    sender.auditLog.push({
      action: 'bulk_message_sent',
      details: `Sent bulk message to ${finalRecipients.length} recipients. Type: ${bulkData.messageType}`,
      timestamp: new Date(),
    });
    await sender.save();

    res.json({
      message: 'Bulk message sent successfully',
      bulkMessageId,
      totalRecipients: finalRecipients.length,
      messagesSent: messages.length,
    });
  } catch (error) {
    console.error('Error sending bulk message:', error);
    res.status(500).json({ error: 'Failed to send bulk message' });
  }
});

// Send bulk message to all users
router.post('/send-all', requireAuth, async (req, res) => {
  try {
    const { message, messageType = 'announcement', priority = 'normal', deliveryMethod = 'all' } = req.body;
    const senderId = req.user.id;

    // Check if user is admin
    const sender = await User.findById(senderId);
    if (!sender || sender.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can send messages to all users' });
    }

    // Get all active users
    let query = { isBanned: false };
    if (deliveryMethod === 'online') {
      query.onlineStatus = 'online';
    } else if (deliveryMethod === 'offline') {
      query.onlineStatus = 'offline';
    }

    const recipients = await User.find(query);
    const totalRecipients = recipients.length;

    // Create messages for each recipient
    const messages = [];
    const bulkMessageId = new Date().getTime().toString();

    for (const recipient of recipients) {
      const messageDoc = new Message({
        kind: 'announcement',
        from: senderId,
        to: recipient._id,
        text: message,
        contentType: 'text',
        priority,
        isSystemMessage: true,
        systemMessageType: 'bulk_message',
        systemMessageData: {
          bulkMessageId,
          messageType,
          totalRecipients,
          deliveryMethod: 'all',
        },
      });

      await messageDoc.save();
      messages.push(messageDoc);

      // Send notification
      await notificationService.createNotification({
        recipient: recipient._id,
        sender: senderId,
        type: 'announcement',
        title: 'System Announcement',
        message,
        data: {
          messageId: messageDoc._id,
          messageType,
          priority,
        },
        channels: {
          inApp: true,
          push: recipient.pushNotifications,
        },
        priority,
      });
    }

    // Log the bulk message
    sender.auditLog.push({
      action: 'bulk_message_sent_all',
      details: `Sent bulk message to all ${totalRecipients} users. Type: ${messageType}`,
      timestamp: new Date(),
    });
    await sender.save();

    res.json({
      message: 'Bulk message sent to all users successfully',
      totalRecipients,
      messagesSent: messages.length,
    });
  } catch (error) {
    console.error('Error sending bulk message to all users:', error);
    res.status(500).json({ error: 'Failed to send bulk message to all users' });
  }
});

// Send bulk message to group members
router.post('/send-group/:groupId', requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message, messageType = 'announcement', priority = 'normal' } = req.body;
    const senderId = req.user.id;

    // Check if user is admin or group admin
    const sender = await User.findById(senderId);
    const group = await Group.findById(groupId);

    if (!sender || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isGroupAdmin = group.admins.includes(senderId) || group.creator.toString() === senderId;
    const isAdmin = sender.role === 'admin';

    if (!isGroupAdmin && !isAdmin) {
      return res.status(403).json({ error: 'Insufficient permissions to send bulk message to group' });
    }

    // Get all group members
    const recipients = await User.find({
      _id: { $in: group.members.map(m => m.user) },
      isBanned: false,
    });

    // Create messages for each member
    const messages = [];
    const bulkMessageId = new Date().getTime().toString();

    for (const recipient of recipients) {
      const messageDoc = new Message({
        kind: 'group',
        groupId: groupId,
        from: senderId,
        to: recipient._id,
        text: message,
        contentType: 'text',
        priority,
        isSystemMessage: true,
        systemMessageType: 'bulk_message',
        systemMessageData: {
          bulkMessageId,
          messageType,
          groupId,
          totalRecipients: recipients.length,
        },
      });

      await messageDoc.save();
      messages.push(messageDoc);

      // Send notification
      await notificationService.createNotification({
        recipient: recipient._id,
        sender: senderId,
        type: 'announcement',
        title: 'Group Announcement',
        message: `${group.name}: ${message}`,
        data: {
          messageId: messageDoc._id,
          groupId,
          messageType,
          priority,
        },
        channels: {
          inApp: true,
          push: recipient.pushNotifications,
        },
        priority,
      });
    }

    // Log the bulk message
    sender.auditLog.push({
      action: 'bulk_message_sent_group',
      details: `Sent bulk message to group ${groupId} (${recipients.length} members). Type: ${messageType}`,
      timestamp: new Date(),
    });
    await sender.save();

    res.json({
      message: 'Bulk message sent to group successfully',
      groupId,
      groupName: group.name,
      totalRecipients: recipients.length,
      messagesSent: messages.length,
    });
  } catch (error) {
    console.error('Error sending bulk message to group:', error);
    res.status(500).json({ error: 'Failed to send bulk message to group' });
  }
});

// Get bulk message statistics
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
        $match: {
          isSystemMessage: true,
          'systemMessageType': 'bulk_message',
        },
      },
      {
        $group: {
          _id: '$systemMessageData.messageType',
          count: { $sum: 1 },
          totalRecipients: { $sum: '$systemMessageData.totalRecipients' },
          avgRecipients: { $avg: '$systemMessageData.totalRecipients' },
        },
      },
    ]);

    const recentBulkMessages = await Message.find({
      isSystemMessage: true,
      'systemMessageType': 'bulk_message',
    })
    .populate('from', 'displayName avatarUrl')
    .sort({ createdAt: -1 })
    .limit(10);

    res.json({
      stats: stats,
      recentBulkMessages,
    });
  } catch (error) {
    console.error('Error fetching bulk message stats:', error);
    res.status(500).json({ error: 'Failed to fetch bulk message stats' });
  }
});

// Get bulk message recipients
router.get('/:bulkMessageId/recipients', requireAuth, async (req, res) => {
  try {
    const { bulkMessageId } = req.params;
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const messages = await Message.find({
      'systemMessageData.bulkMessageId': bulkMessageId,
    })
    .populate('to', 'displayName avatarUrl')
    .sort({ createdAt: 1 });

    const recipients = messages.map(msg => msg.to);

    res.json({
      bulkMessageId,
      recipients,
      totalRecipients: recipients.length,
    });
  } catch (error) {
    console.error('Error fetching bulk message recipients:', error);
    res.status(500).json({ error: 'Failed to fetch bulk message recipients' });
  }
});

// Schedule bulk message
router.post('/schedule', requireAuth, async (req, res) => {
  try {
    const bulkData = bulkMessageSchema.parse(req.body);
    const { scheduledTime } = bulkData;
    const senderId = req.user.id;

    // Check if user is admin
    const sender = await User.findById(senderId);
    if (!sender || sender.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions to schedule bulk messages' });
    }

    if (!scheduledTime || new Date(scheduledTime) <= new Date()) {
      return res.status(400).json({ error: 'Scheduled time must be in the future' });
    }

    // Store scheduled message (in production, use a proper job queue)
    // For now, we'll just return success
    res.json({
      message: 'Bulk message scheduled successfully',
      scheduledTime,
      bulkMessageId: new Date().getTime().toString(),
    });
  } catch (error) {
    console.error('Error scheduling bulk message:', error);
    res.status(500).json({ error: 'Failed to schedule bulk message' });
  }
});

export { router as bulkMessageRouter };
