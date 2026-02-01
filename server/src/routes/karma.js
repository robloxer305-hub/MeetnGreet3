import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { Achievement } from '../models/Achievement.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for karma updates
const karmaUpdateSchema = z.object({
  targetUserId: z.string(),
  amount: z.number(),
  reason: z.string(),
  type: z.enum(['message_reaction', 'helpful_post', 'good_behavior', 'moderation_action', 'achievement', 'manual']),
});

// Get user's karma and reputation
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .select('karma reputation level experience achievements displayName avatarUrl');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate reputation level based on karma
    const reputationLevel = calculateReputationLevel(user.karma);
    
    // Get user's achievements
    const achievements = await Achievement.find({
      _id: { $in: user.achievements }
    });

    res.json({
      user: {
        id: user._id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        karma: user.karma,
        reputation: user.reputation,
        level: user.level,
        experience: user.experience,
        reputationLevel,
        achievements: achievements,
        achievementCount: achievements.length,
      },
    });
  } catch (error) {
    console.error('Error fetching user karma:', error);
    res.status(500).json({ error: 'Failed to fetch user karma' });
  }
});

// Update user's karma
router.post('/update', requireAuth, async (req, res) => {
  try {
    const { targetUserId, amount, reason, type } = karmaUpdateSchema.parse(req.body);
    const adminUserId = req.user.id;

    // Check if user has permission to update karma
    const adminUser = await User.findById(adminUserId);
    if (!adminUser || !['admin', 'moderator'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Update karma
    const oldKarma = targetUser.karma;
    targetUser.karma += amount;
    targetUser.reputation = calculateReputation(targetUser.karma);
    
    // Check for level up
    const oldLevel = targetUser.level;
    const newLevel = calculateLevel(targetUser.experience);
    if (newLevel > oldLevel) {
      targetUser.level = newLevel;
    }

    await targetUser.save();

    // Log the karma update
    adminUser.auditLog.push({
      action: 'karma_updated',
      details: `Updated karma for user ${targetUserId} by ${amount}. Reason: ${reason}`,
      timestamp: new Date(),
    });
    await adminUser.save();

    // Check for new achievements
    await checkKarmaAchievements(targetUser);

    res.json({
      message: 'Karma updated successfully',
      oldKarma,
      newKarma: targetUser.karma,
      reputation: targetUser.reputation,
      level: targetUser.level,
    });
  } catch (error) {
    console.error('Error updating karma:', error);
    res.status(500).json({ error: 'Failed to update karma' });
  }
});

// Get karma leaderboard
router.get('/leaderboard/top', async (req, res) => {
  try {
    const { limit = 10, period = 'all_time' } = req.query;

    let query = {};
    let sort = { karma: -1 };

    // For different time periods, you would need to track karma history
    // For now, we'll just return all-time leaderboard

    const topUsers = await User.find(query)
      .select('displayName avatarUrl karma reputation level')
      .sort(sort)
      .limit(parseInt(limit));

    res.json({
      leaderboard: topUsers.map((user, index) => ({
        rank: index + 1,
        id: user._id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        karma: user.karma,
        reputation: user.reputation,
        level: user.level,
        reputationLevel: calculateReputationLevel(user.karma),
      })),
    });
  } catch (error) {
    console.error('Error fetching karma leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch karma leaderboard' });
  }
});

// Get user's karma history
router.get('/:userId/history', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check if user is requesting their own history or is admin/moderator
    const requestingUser = await User.findById(req.user.id);
    if (userId !== req.user.id && !['admin', 'moderator'].includes(requestingUser.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Filter audit log for karma-related events
    const karmaEvents = user.auditLog
      .filter(log => log.action.includes('karma') || log.details.includes('karma'))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice((page - 1) * limit, page * limit);

    res.json({
      history: karmaEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: karmaEvents.length,
        pages: Math.ceil(karmaEvents.length / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching karma history:', error);
    res.status(500).json({ error: 'Failed to fetch karma history' });
  }
});

// Award experience points
router.post('/award-experience', requireAuth, async (req, res) => {
  try {
    const { targetUserId, amount, reason } = req.body;
    const adminUserId = req.user.id;

    // Check if user has permission to award experience
    const adminUser = await User.findById(adminUserId);
    if (!adminUser || !['admin', 'moderator'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const oldExperience = targetUser.experience;
    const oldLevel = targetUser.level;
    
    targetUser.experience += amount;
    targetUser.level = calculateLevel(targetUser.experience);
    
    await targetUser.save();

    // Check for level up achievements
    if (targetUser.level > oldLevel) {
      await checkLevelAchievements(targetUser);
    }

    // Log the experience award
    adminUser.auditLog.push({
      action: 'experience_awarded',
      details: `Awarded ${amount} experience to user ${targetUserId}. Reason: ${reason}`,
      timestamp: new Date(),
    });
    await adminUser.save();

    res.json({
      message: 'Experience awarded successfully',
      oldExperience,
      newExperience: targetUser.experience,
      oldLevel,
      newLevel: targetUser.level,
    });
  } catch (error) {
    console.error('Error awarding experience:', error);
    res.status(500).json({ error: 'Failed to award experience' });
  }
});

// Get user's achievements
router.get('/:userId/achievements', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('achievements');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const achievements = await Achievement.find({
      _id: { $in: user.achievements }
    });

    res.json({
      achievements,
      totalAchievements: achievements.length,
    });
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({ error: 'Failed to fetch user achievements' });
  }
});

// Helper functions
function calculateReputation(karma) {
  // Simple reputation calculation based on karma
  if (karma >= 1000) return 5;
  if (karma >= 500) return 4;
  if (karma >= 200) return 3;
  if (karma >= 50) return 2;
  if (karma >= 10) return 1;
  return 0;
}

function calculateReputationLevel(karma) {
  if (karma >= 1000) return 'Legendary';
  if (karma >= 500) return 'Master';
  if (karma >= 200) return 'Expert';
  if (karma >= 50) return 'Advanced';
  if (karma >= 10) return 'Intermediate';
  return 'Beginner';
}

function calculateLevel(experience) {
  // Simple level calculation: 100 XP per level
  return Math.floor(experience / 100) + 1;
}

async function checkKarmaAchievements(user) {
  try {
    const achievements = await Achievement.find({
      type: 'karma',
      isActive: true,
    });

    for (const achievement of achievements) {
      // Check if user already has this achievement
      if (user.achievements.includes(achievement._id)) {
        continue;
      }

      // Check if user meets the requirements
      if (user.karma >= achievement.requirements.value) {
        user.achievements.push(achievement._id);
        
        // Award experience for achievement
        user.experience += achievement.rewards.experience || 0;
        user.karma += achievement.rewards.karma || 0;
        
        // Log achievement
        user.auditLog.push({
          action: 'achievement_earned',
          details: `Earned achievement: ${achievement.name}`,
          timestamp: new Date(),
        });
      }
    }

    await user.save();
  } catch (error) {
    console.error('Error checking karma achievements:', error);
  }
}

async function checkLevelAchievements(user) {
  try {
    const achievements = await Achievement.find({
      type: 'level',
      isActive: true,
    });

    for (const achievement of achievements) {
      // Check if user already has this achievement
      if (user.achievements.includes(achievement._id)) {
        continue;
      }

      // Check if user meets the requirements
      if (user.level >= achievement.requirements.value) {
        user.achievements.push(achievement._id);
        
        // Award rewards for achievement
        user.experience += achievement.rewards.experience || 0;
        user.karma += achievement.rewards.karma || 0;
        
        // Log achievement
        user.auditLog.push({
          action: 'achievement_earned',
          details: `Earned achievement: ${achievement.name}`,
          timestamp: new Date(),
        });
      }
    }

    await user.save();
  } catch (error) {
    console.error('Error checking level achievements:', error);
  }
}

export { router as karmaRouter };
