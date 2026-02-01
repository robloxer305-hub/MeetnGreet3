import express from 'express';
import { z } from 'zod';
import { Poll } from '../models/Poll.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for creating polls
const createPollSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  options: z.array(z.object({
    text: z.string().min(1).max(100),
    color: z.string().default('#007bff'),
  })).min(2).max(10),
  multipleChoice: z.boolean().default(false),
  maxChoices: z.number().min(1).max(10).default(1),
  anonymous: z.boolean().default(false),
  publicResults: z.boolean().default(true),
  duration: z.number().min(0).max(8760).default(0), // hours, 0 = no end time
  context: z.object({
    type: z.enum(['message', 'group', 'room', 'global']),
    id: z.string(),
  }),
  allowAddOptions: z.boolean().default(false),
  requireLogin: z.boolean().default(true),
  minReputation: z.number().default(0),
  allowComments: z.boolean().default(true),
  shareableLink: z.boolean().default(true),
});

// Schema for voting on polls
const voteSchema = z.object({
  optionIds: z.array(z.string()).min(1),
});

// Create a new poll
router.post('/', requireAuth, async (req, res) => {
  try {
    const pollData = createPollSchema.parse(req.body);
    const creatorId = req.user.id;

    // Set end time if duration is specified
    if (pollData.duration > 0) {
      pollData.endsAt = new Date(Date.now() + pollData.duration * 60 * 60 * 1000);
    }

    const poll = new Poll({
      ...pollData,
      creator: creatorId,
      options: pollData.options.map((option, index) => ({
        ...option,
        order: index,
      })),
    });

    await poll.save();

    // If poll is attached to a message, update the message
    if (pollData.context.type === 'message') {
      await Message.findByIdAndUpdate(pollData.context.id, {
        pollData: {
          question: poll.title,
          options: poll.options.map(opt => ({
            text: opt.text,
            votes: 0,
            voters: [],
          })),
          multipleChoice: poll.multipleChoice,
          endsAt: poll.endsAt,
          isActive: true,
        },
        contentType: 'poll',
      });
    }

    // Send notification to relevant users
    await sendPollNotifications(poll);

    // Populate creator info
    await poll.populate('creator', 'displayName avatarUrl');

    res.status(201).json({
      message: 'Poll created successfully',
      poll,
    });
  } catch (error) {
    console.error('Error creating poll:', error);
    res.status(500).json({ error: 'Failed to create poll' });
  }
});

// Get poll by ID
router.get('/:pollId', async (req, res) => {
  try {
    const { pollId } = req.params;

    const poll = await Poll.findById(pollId)
      .populate('creator', 'displayName avatarUrl')
      .populate('comments.user', 'displayName avatarUrl');

    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if poll is expired
    if (poll.endsAt && new Date() > poll.endsAt) {
      poll.isActive = false;
      await poll.save();
    }

    // Remove voter info if anonymous poll
    if (poll.anonymous) {
      poll.options = poll.options.map(option => ({
        ...option.toObject(),
        voters: [],
      }));
    }

    res.json({ poll });
  } catch (error) {
    console.error('Error fetching poll:', error);
    res.status(500).json({ error: 'Failed to fetch poll' });
  }
});

// Vote on a poll
router.post('/:pollId/vote', requireAuth, async (req, res) => {
  try {
    const { pollId } = req.params;
    const { optionIds } = voteSchema.parse(req.body);
    const userId = req.user.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if poll is active
    if (!poll.isActive) {
      return res.status(400).json({ error: 'Poll is no longer active' });
    }

    // Check if poll has expired
    if (poll.endsAt && new Date() > poll.endsAt) {
      return res.status(400).json({ error: 'Poll has expired' });
    }

    // Check user permissions
    if (poll.requireLogin) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (user.reputation < poll.minReputation) {
        return res.status(403).json({ error: 'Insufficient reputation to vote' });
      }
    }

    // Check if user has already voted
    const hasVoted = poll.options.some(option => 
      option.voters.some(voter => voter.toString() === userId)
    );

    if (hasVoted) {
      return res.status(400).json({ error: 'You have already voted on this poll' });
    }

    // Validate vote options
    if (!poll.multipleChoice && optionIds.length > 1) {
      return res.status(400).json({ error: 'Multiple choices not allowed for this poll' });
    }

    if (optionIds.length > poll.maxChoices) {
      return res.status(400).json({ error: `Maximum ${poll.maxChoices} choices allowed` });
    }

    // Check if all option IDs are valid
    const validOptionIds = poll.options.map(opt => opt._id.toString());
    const invalidOptions = optionIds.filter(id => !validOptionIds.includes(id));
    if (invalidOptions.length > 0) {
      return res.status(400).json({ error: 'Invalid option IDs' });
    }

    // Add votes
    optionIds.forEach(optionId => {
      const option = poll.options.find(opt => opt._id.toString() === optionId);
      if (option) {
        option.voters.push(userId);
        option.votes += 1;
      }
    });

    poll.totalVotes += 1;
    poll.uniqueVoters += 1;

    await poll.save();

    // Send notification to poll creator
    if (poll.creator.toString() !== userId) {
      await notificationService.createNotification({
        recipient: poll.creator,
        type: 'social',
        title: 'New Poll Vote',
        message: `Someone voted on your poll: ${poll.title}`,
        data: {
          pollId,
        },
        channels: {
          inApp: true,
        },
      });
    }

    res.json({
      message: 'Vote recorded successfully',
      totalVotes: poll.totalVotes,
      uniqueVoters: poll.uniqueVoters,
    });
  } catch (error) {
    console.error('Error voting on poll:', error);
    res.status(500).json({ error: 'Failed to vote on poll' });
  }
});

// Add option to poll (if allowed)
router.post('/:pollId/options', requireAuth, async (req, res) => {
  try {
    const { pollId } = req.params;
    const { text, color } = req.body;
    const userId = req.user.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if adding options is allowed
    if (!poll.allowAddOptions) {
      return res.status(403).json({ error: 'Adding options is not allowed for this poll' });
    }

    // Check if user is poll creator or has sufficient permissions
    if (poll.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Only poll creator can add options' });
    }

    // Check if poll is still active
    if (!poll.isActive) {
      return res.status(400).json({ error: 'Poll is no longer active' });
    }

    // Add new option
    const newOption = {
      text,
      color: color || '#007bff',
      votes: 0,
      voters: [],
      order: poll.options.length,
    };

    poll.options.push(newOption);
    await poll.save();

    res.json({
      message: 'Option added successfully',
      option: newOption,
    });
  } catch (error) {
    console.error('Error adding poll option:', error);
    res.status(500).json({ error: 'Failed to add poll option' });
  }
});

// End poll (creator only)
router.post('/:pollId/end', requireAuth, async (req, res) => {
  try {
    const { pollId } = req.params;
    const userId = req.user.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if user is poll creator
    if (poll.creator.toString() !== userId) {
      return res.status(403).json({ error: 'Only poll creator can end the poll' });
    }

    // End the poll
    poll.isActive = false;
    poll.closedAt = new Date();
    poll.closedBy = userId;

    await poll.save();

    // Send notification about poll results
    await sendPollResultsNotification(poll);

    res.json({
      message: 'Poll ended successfully',
      results: {
        totalVotes: poll.totalVotes,
        uniqueVoters: poll.uniqueVoters,
        options: poll.options.map(option => ({
          text: option.text,
          votes: option.votes,
          percentage: poll.totalVotes > 0 ? (option.votes / poll.totalVotes * 100).toFixed(2) : 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error ending poll:', error);
    res.status(500).json({ error: 'Failed to end poll' });
  }
});

// Get polls for a context
router.get('/context/:contextType/:contextId', async (req, res) => {
  try {
    const { contextType, contextId } = req.params;
    const { page = 1, limit = 20, activeOnly } = req.query;

    let query = {
      'context.type': contextType,
      'context.id': contextId,
    };

    if (activeOnly === 'true') {
      query.isActive = true;
    }

    const polls = await Poll.find(query)
      .populate('creator', 'displayName avatarUrl')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Poll.countDocuments(query);

    res.json({
      polls,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching polls for context:', error);
    res.status(500).json({ error: 'Failed to fetch polls' });
  }
});

// Add comment to poll
router.post('/:pollId/comments', requireAuth, async (req, res) => {
  try {
    const { pollId } = req.params;
    const { text } = req.body;
    const userId = req.user.id;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    // Check if comments are allowed
    if (!poll.allowComments) {
      return res.status(403).json({ error: 'Comments are not allowed for this poll' });
    }

    // Add comment
    poll.comments.push({
      user: userId,
      text,
      createdAt: new Date(),
    });

    await poll.save();

    // Populate comment user info
    await poll.populate('comments.user', 'displayName avatarUrl');

    const newComment = poll.comments[poll.comments.length - 1];

    res.status(201).json({
      message: 'Comment added successfully',
      comment: newComment,
    });
  } catch (error) {
    console.error('Error adding poll comment:', error);
    res.status(500).json({ error: 'Failed to add poll comment' });
  }
});

// Get poll statistics
router.get('/:pollId/stats', async (req, res) => {
  try {
    const { pollId } = req.params;

    const poll = await Poll.findById(pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }

    const stats = {
      totalVotes: poll.totalVotes,
      uniqueVoters: poll.uniqueVoters,
      optionsCount: poll.options.length,
      commentsCount: poll.comments.length,
      isActive: poll.isActive,
      createdAt: poll.createdAt,
      endsAt: poll.endsAt,
      closedAt: poll.closedAt,
      votingDuration: poll.endsAt ? 
        Math.round((poll.endsAt - poll.createdAt) / (1000 * 60 * 60)) : null, // hours
    };

    // Add voting analytics
    if (poll.totalVotes > 0) {
      stats.options = poll.options.map(option => ({
        text: option.text,
        votes: option.votes,
        percentage: (option.votes / poll.totalVotes * 100).toFixed(2),
        voters: option.voters.length,
      }));

      stats.leadingOption = poll.options.reduce((prev, current) => 
        prev.votes > current.votes ? prev : current
      );
    }

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching poll stats:', error);
    res.status(500).json({ error: 'Failed to fetch poll stats' });
  }
});

// Helper functions
async function sendPollNotifications(poll) {
  try {
    // This would send notifications to relevant users based on context
    // For now, we'll just log it
    console.log(`Poll created: ${poll.title} in ${poll.context.type}:${poll.context.id}`);
  } catch (error) {
    console.error('Error sending poll notifications:', error);
  }
}

async function sendPollResultsNotification(poll) {
  try {
    // Send notification to poll creator
    await notificationService.createNotification({
      recipient: poll.creator,
      type: 'social',
      title: 'Poll Results Available',
      message: `Your poll "${poll.title}" has ended with ${poll.totalVotes} total votes`,
      data: {
        pollId: poll._id,
      },
      channels: {
        inApp: true,
      },
    });
  } catch (error) {
    console.error('Error sending poll results notification:', error);
  }
}

export { router as pollsRouter };
