import express from 'express';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for editing messages
const editMessageSchema = z.object({
  text: z.string().min(1).max(4000),
});

// Schema for deleting messages
const deleteMessageSchema = z.object({
  reason: z.string().optional(),
});

// Edit message
router.patch('/:messageId/edit', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = editMessageSchema.parse(req.body);
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user can edit this message
    if (!canUserEditMessage(userId, message)) {
      return res.status(403).json({ error: 'Cannot edit this message' });
    }

    // Check if message is too old to edit (24 hours)
    const editTimeLimit = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
      return res.status(400).json({ error: 'Message is too old to edit' });
    }

    // Store original text in edit history
    message.editHistory.push({
      text: message.text,
      editedAt: new Date(),
    });

    // Update message
    message.text = text;
    message.isEdited = true;

    await message.save();

    // Emit socket event for real-time updates
    req.io.to(message.roomId || message.groupId?.toString()).emit('message_edited', {
      messageId,
      newText: text,
      isEdited: true,
      editedAt: message.updatedAt,
      editHistory: message.editHistory,
    });

    res.json({ 
      message: 'Message edited successfully',
      text,
      isEdited: true,
      editedAt: message.updatedAt,
    });

  } catch (error) {
    console.error('Error editing message:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

// Delete message
router.delete('/:messageId', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reason } = deleteMessageSchema.parse(req.body);
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user can delete this message
    const canDelete = await canUserDeleteMessage(userId, message);
    if (!canDelete.allowed) {
      return res.status(403).json({ error: canDelete.reason || 'Cannot delete this message' });
    }

    // Soft delete message
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.deletedBy = userId;

    await message.save();

    // Log deletion for audit
    await logMessageDeletion(messageId, userId, reason);

    // Emit socket event for real-time updates
    req.io.to(message.roomId || message.groupId?.toString()).emit('message_deleted', {
      messageId,
      deletedBy: userId,
      deletedAt: message.deletedAt,
    });

    res.json({ 
      message: 'Message deleted successfully',
      deletedAt: message.deletedAt,
    });

  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Restore message (for moderators/admins)
router.post('/:messageId/restore', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user can restore this message
    const user = await User.findById(userId);
    if (!user || !['admin', 'moderator'].includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to restore message' });
    }

    if (!message.isDeleted) {
      return res.status(400).json({ error: 'Message is not deleted' });
    }

    // Restore message
    message.isDeleted = false;
    message.deletedAt = null;
    message.deletedBy = null;

    await message.save();

    // Emit socket event
    req.io.to(message.roomId || message.groupId?.toString()).emit('message_restored', {
      messageId,
      restoredBy: userId,
      restoredAt: new Date(),
    });

    res.json({ 
      message: 'Message restored successfully',
    });

  } catch (error) {
    console.error('Error restoring message:', error);
    res.status(500).json({ error: 'Failed to restore message' });
  }
});

// Get message edit history
router.get('/:messageId/history', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user can view edit history
    if (!canUserViewMessageHistory(userId, message)) {
      return res.status(403).json({ error: 'Cannot view message history' });
    }

    res.json({ 
      editHistory: message.editHistory,
      isEdited: message.isEdited,
    });

  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

// Helper function to check if user can edit message
function canUserEditMessage(userId, message) {
  // Users can only edit their own messages
  return message.from.toString() === userId;
}

// Helper function to check if user can delete message
async function canUserDeleteMessage(userId, message) {
  const user = await User.findById(userId);
  
  // Users can delete their own messages
  if (message.from.toString() === userId) {
    return { allowed: true };
  }

  // Admins and moderators can delete any message
  if (user && ['admin', 'moderator'].includes(user.role)) {
    return { allowed: true };
  }

  // Group admins can delete messages in their groups
  if (message.kind === 'group' && user) {
    // This would require checking group membership
    return { allowed: false, reason: 'Not a group admin' };
  }

  return { allowed: false, reason: 'Insufficient permissions' };
}

// Helper function to check if user can view message history
function canUserViewMessageHistory(userId, message) {
  // Users can view their own message history
  if (message.from.toString() === userId) {
    return true;
  }

  // Admins and moderators can view any message history
  // This would require checking user role
  return false;
}

// Helper function to log message deletion
async function logMessageDeletion(messageId, deletedBy, reason) {
  try {
    const user = await User.findById(deletedBy);
    if (user) {
      user.auditLog.push({
        action: 'message_deleted',
        details: `Message ${messageId} deleted. Reason: ${reason || 'Not specified'}`,
        timestamp: new Date(),
      });
      await user.save();
    }
  } catch (error) {
    console.error('Error logging message deletion:', error);
  }
}

export { router as messageEditRouter };
