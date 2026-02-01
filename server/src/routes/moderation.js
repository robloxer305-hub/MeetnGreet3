import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Report } from '../models/Report.js';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for blocking users
const blockUserSchema = z.object({
  userId: z.string(),
  reason: z.string().optional(),
});

// Schema for reporting users/messages
const reportSchema = z.object({
  reportedUser: z.string().optional(),
  reportedMessage: z.string().optional(),
  reportedGroup: z.string().optional(),
  reportedRoom: z.string().optional(),
  reason: z.enum(['spam', 'harassment', 'inappropriate_content', 'violence', 'copyright', 'impersonation', 'other']),
  description: z.string(),
  category: z.enum(['user', 'message', 'group', 'room']),
});

// Block a user
router.post('/block', requireAuth, async (req, res) => {
  try {
    const { userId, reason } = blockUserSchema.parse(req.body);
    const blockerId = req.user.id;

    if (userId === blockerId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const userToBlock = await User.findById(userId);
    if (!userToBlock) {
      return res.status(404).json({ error: 'User not found' });
    }

    const blocker = await User.findById(blockerId);
    if (!blocker) {
      return res.status(404).json({ error: 'Blocker not found' });
    }

    // Check if already blocked
    if (blocker.blockedUsers.includes(userId)) {
      return res.status(400).json({ error: 'User already blocked' });
    }

    // Add to blocked users list
    blocker.blockedUsers.push(userId);
    await blocker.save();

    // Remove from friends if they were friends
    if (blocker.friends.includes(userId)) {
      blocker.friends.pull(userId);
      await blocker.save();
      
      // Remove from other user's friends list
      userToBlock.friends.pull(blockerId);
      await userToBlock.save();
    }

    // Remove from followers/following if following system is used
    if (blocker.following.includes(userId)) {
      blocker.following.pull(userId);
      await blocker.save();
    }
    
    if (userToBlock.followers.includes(blockerId)) {
      userToBlock.followers.pull(blockerId);
      await userToBlock.save();
    }

    // Log the block action
    blocker.auditLog.push({
      action: 'user_blocked',
      details: `Blocked user ${userId}. Reason: ${reason || 'Not specified'}`,
      timestamp: new Date(),
    });
    await blocker.save();

    res.json({
      message: 'User blocked successfully',
      blockedUser: {
        id: userToBlock._id,
        displayName: userToBlock.displayName,
        avatarUrl: userToBlock.avatarUrl,
      },
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Unblock a user
router.post('/unblock', requireAuth, async (req, res) => {
  try {
    const { userId } = blockUserSchema.parse(req.body);
    const unblockerId = req.user.id;

    const unblocker = await User.findById(unblockerId);
    if (!unblocker) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is blocked
    if (!unblocker.blockedUsers.includes(userId)) {
      return res.status(400).json({ error: 'User is not blocked' });
    }

    // Remove from blocked users list
    unblocker.blockedUsers.pull(userId);
    await unblocker.save();

    // Log the unblock action
    unblocker.auditLog.push({
      action: 'user_unblocked',
      details: `Unblocked user ${userId}`,
      timestamp: new Date(),
    });
    await unblocker.save();

    res.json({
      message: 'User unblocked successfully',
    });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Get blocked users list
router.get('/blocked', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('blockedUsers', 'displayName avatarUrl');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      blockedUsers: user.blockedUsers,
    });
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// Mute a user (temporary block from seeing their messages)
router.post('/mute', requireAuth, async (req, res) => {
  try {
    const { userId, duration } = req.body; // duration in hours
    const muterId = req.user.id;

    if (userId === muterId) {
      return res.status(400).json({ error: 'Cannot mute yourself' });
    }

    const userToMute = await User.findById(userId);
    if (!userToMute) {
      return res.status(404).json({ error: 'User not found' });
    }

    const muter = await User.findById(muterId);
    if (!muter) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already muted
    if (muter.mutedUsers.includes(userId)) {
      return res.status(400).json({ error: 'User already muted' });
    }

    // Add to muted users list
    muter.mutedUsers.push(userId);
    await muter.save();

    // Schedule unmute if duration is specified
    if (duration && duration > 0) {
      setTimeout(async () => {
        try {
          await User.findByIdAndUpdate(muterId, {
            $pull: { mutedUsers: userId },
          });
        } catch (error) {
          console.error('Error auto-unmuting user:', error);
        }
      }, duration * 60 * 60 * 1000); // Convert hours to milliseconds
    }

    res.json({
      message: 'User muted successfully',
      mutedUser: {
        id: userToMute._id,
        displayName: userToMute.displayName,
        avatarUrl: userToMute.avatarUrl,
      },
      duration: duration || 'indefinite',
    });
  } catch (error) {
    console.error('Error muting user:', error);
    res.status(500).json({ error: 'Failed to mute user' });
  }
});

// Unmute a user
router.post('/unmute', requireAuth, async (req, res) => {
  try {
    const { userId } = req.body;
    const unmuteId = req.user.id;

    const unmuteUser = await User.findById(unmuteId);
    if (!unmuteUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is muted
    if (!unmuteUser.mutedUsers.includes(userId)) {
      return res.status(400).json({ error: 'User is not muted' });
    }

    // Remove from muted users list
    unmuteUser.mutedUsers.pull(userId);
    await unmuteUser.save();

    res.json({
      message: 'User unmuted successfully',
    });
  } catch (error) {
    console.error('Error unmuting user:', error);
    res.status(500).json({ error: 'Failed to unmute user' });
  }
});

// Get muted users list
router.get('/muted', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId)
      .populate('mutedUsers', 'displayName avatarUrl');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      mutedUsers: user.mutedUsers,
    });
  } catch (error) {
    console.error('Error fetching muted users:', error);
    res.status(500).json({ error: 'Failed to fetch muted users' });
  }
});

// Report a user, message, group, or room
router.post('/report', requireAuth, async (req, res) => {
  try {
    const reportData = reportSchema.parse(req.body);
    const reporterId = req.user.id;

    // Validate that at least one target is specified
    if (!reportData.reportedUser && !reportData.reportedMessage && !reportData.reportedGroup && !reportData.reportedRoom) {
      return res.status(400).json({ error: 'Must specify at least one target to report' });
    }

    // Check if similar report already exists
    const existingReport = await Report.findOne({
      reporter: reporterId,
      reportedUser: reportData.reportedUser,
      reportedMessage: reportData.reportedMessage,
      reportedGroup: reportData.reportedGroup,
      reportedRoom: reportData.reportedRoom,
      status: { $in: ['pending', 'under_review'] },
    });

    if (existingReport) {
      return res.status(400).json({ error: 'You have already reported this content' });
    }

    // Create report
    const report = new Report({
      ...reportData,
      reporter: reporterId,
      status: 'pending',
      priority: determineReportPriority(reportData.reason),
    });

    await report.save();

    // Auto-analyze content if available
    if (reportData.reportedMessage) {
      const Message = (await import('../models/Message.js')).Message;
      const message = await Message.findById(reportData.reportedMessage);
      if (message) {
        // Simple content analysis (could be enhanced with AI/ML)
        const toxicityScore = analyzeToxicity(message.text);
        const spamScore = analyzeSpam(message.text);
        
        report.aiAnalysis = {
          toxicityScore,
          spamScore,
          categories: extractCategories(message.text),
          confidence: Math.max(toxicityScore, spamScore),
        };
        await report.save();
      }
    }

    // Notify moderators/admins
    await notifyModerators(report);

    res.status(201).json({
      message: 'Report submitted successfully',
      report,
    });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// Get user's reports
router.get('/reports', requireAuth, async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    let query = { reporter: reporterId };
    if (status) {
      query.status = status;
    }

    const reports = await Report.find(query)
      .populate('reportedUser', 'displayName avatarUrl')
      .populate('reportedMessage', 'text createdAt')
      .populate('reviewedBy', 'displayName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Report.countDocuments(query);

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Helper functions
function determineReportPriority(reason) {
  const priorityMap = {
    harassment: 'high',
    violence: 'critical',
    inappropriate_content: 'medium',
    spam: 'low',
    copyright: 'medium',
    impersonation: 'high',
    other: 'medium',
  };
  return priorityMap[reason] || 'medium';
}

function analyzeToxicity(text) {
  // Simple toxicity analysis (would be enhanced with proper NLP)
  const toxicWords = ['hate', 'kill', 'die', 'stupid', 'idiot', 'ugly', 'disgusting'];
  const words = text.toLowerCase().split(' ');
  const toxicCount = words.filter(word => toxicWords.includes(word)).length;
  return Math.min(toxicCount / words.length, 1);
}

function analyzeSpam(text) {
  // Simple spam analysis
  const spamIndicators = [
    text.includes('click here'),
    text.includes('buy now'),
    text.includes('free money'),
    text.includes('limited offer'),
    text.match(/https?:\/\//g)?.length > 2,
  ];
  return spamIndicators.filter(Boolean).length / spamIndicators.length;
}

function extractCategories(text) {
  const categories = [];
  if (text.includes('http')) categories.push('links');
  if (text.match(/^[A-Z]/)) categories.push('capitalization');
  if (text.length > 500) categories.push('long_message');
  return categories;
}

async function notifyModerators(report) {
  try {
    // Find all moderators and admins
    const moderators = await User.find({
      role: { $in: ['moderator', 'admin'] },
    });

    // Create notifications for moderators
    for (const moderator of moderators) {
      await notificationService.createNotification({
        recipient: moderator._id,
        type: 'moderation',
        title: 'New Report Submitted',
        message: `A new ${report.category} report has been submitted for review`,
        data: {
          reportId: report._id,
        },
        channels: {
          inApp: true,
          push: moderator.pushNotifications,
        },
        priority: report.priority,
      });
    }
  } catch (error) {
    console.error('Error notifying moderators:', error);
  }
}

export { router as moderationRouter };
