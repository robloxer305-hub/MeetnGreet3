import express from 'express';
import { z } from 'zod';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for adding/removing reactions
const reactionSchema = z.object({
  emoji: z.string().min(1).max(50),
});

// Add reaction to message
router.post('/:messageId/reactions', requireAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = reactionSchema.parse(req.body);
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user can react to this message
    if (!canUserReactToMessage(userId, message)) {
      return res.status(403).json({ error: 'Cannot react to this message' });
    }

    // Find existing reaction
    const existingReaction = message.reactions.find(r => r.emoji === emoji);
    
    if (existingReaction) {
      // Check if user already reacted with this emoji
      if (existingReaction.users.includes(userId)) {
        return res.status(400).json({ error: 'Already reacted with this emoji' });
      }
      
      // Add user to existing reaction
      existingReaction.users.push(userId);
      existingReaction.count += 1;
    } else {
      // Create new reaction
      message.reactions.push({
        emoji,
        users: [userId],
        count: 1,
      });
    }

    await message.save();

    // Update user karma for positive engagement
    await updateUserKarma(message.from, 1);

    // Emit socket event for real-time updates
    req.io.to(message.roomId || message.groupId?.toString()).emit('message_reaction', {
      messageId,
      emoji,
      userId,
      action: 'added',
      reactions: message.reactions,
    });

    res.json({ 
      message: 'Reaction added successfully',
      reactions: message.reactions,
    });

  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Remove reaction from message
router.delete('/:messageId/reactions/:emoji', requireAuth, async (req, res) => {
  try {
    const { messageId, emoji } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Find the reaction
    const reactionIndex = message.reactions.findIndex(r => r.emoji === emoji);
    if (reactionIndex === -1) {
      return res.status(404).json({ error: 'Reaction not found' });
    }

    const reaction = message.reactions[reactionIndex];
    
    // Check if user has this reaction
    const userIndex = reaction.users.indexOf(userId);
    if (userIndex === -1) {
      return res.status(400).json({ error: 'You have not reacted with this emoji' });
    }

    // Remove user from reaction
    reaction.users.splice(userIndex, 1);
    reaction.count -= 1;

    // Remove reaction if no users left
    if (reaction.count === 0) {
      message.reactions.splice(reactionIndex, 1);
    }

    await message.save();

    // Update user karma
    await updateUserKarma(message.from, -1);

    // Emit socket event
    req.io.to(message.roomId || message.groupId?.toString()).emit('message_reaction', {
      messageId,
      emoji,
      userId,
      action: 'removed',
      reactions: message.reactions,
    });

    res.json({ 
      message: 'Reaction removed successfully',
      reactions: message.reactions,
    });

  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// Get all reactions for a message
router.get('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId)
      .populate('reactions.users', 'displayName avatarUrl');

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ reactions: message.reactions });

  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// Helper function to check if user can react to message
function canUserReactToMessage(userId, message) {
  // Users can react to public messages
  if (message.kind === 'public') {
    return true;
  }

  // Users can react to private messages if they are participants
  if (message.kind === 'private') {
    return message.participants.includes(userId);
  }

  // Users can react to group messages if they are group members
  if (message.kind === 'group') {
    // This would require checking group membership
    return true; // Simplified for now
  }

  return false;
}

// Helper function to update user karma
async function updateUserKarma(userId, change) {
  try {
    await User.findByIdAndUpdate(userId, {
      $inc: { karma: change },
    });
  } catch (error) {
    console.error('Error updating user karma:', error);
  }
}

export { router as reactionsRouter };
