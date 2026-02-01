import express from 'express';
import { z } from 'zod';
import { Achievement } from '../models/Achievement.js';
import { User } from '../models/User.js';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for creating achievements
const createAchievementSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  icon: z.string(),
  badgeColor: z.enum(['bronze', 'silver', 'gold', 'platinum', 'diamond']).default('bronze'),
  type: z.enum(['message_count', 'friend_count', 'login_streak', 'group_created', 'moderation', 'special', 'karma', 'level']),
  requirements: z.object({
    value: z.number(),
    metric: z.string(),
    timeframe: z.enum(['daily', 'weekly', 'monthly', 'all_time']).default('all_time'),
  }),
  rewards: z.object({
    experience: z.number().default(0),
    karma: z.number().default(0),
    badge: z.string().default(''),
    title: z.string().default(''),
  }),
  isActive: z.boolean().default(true),
  isHidden: z.boolean().default(false),
  isRepeatable: z.boolean().default(false),
  category: z.enum(['social', 'messaging', 'moderation', 'creativity', 'technical', 'special']).default('social'),
  rarity: z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary']).default('common'),
  expiresAt: z.date().optional(),
});

// Get all achievements
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      rarity, 
      type, 
      isActive, 
      includeHidden = false 
    } = req.query;

    let query = {};
    
    if (category) query.category = category;
    if (rarity) query.rarity = rarity;
    if (type) query.type = type;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (includeHidden !== 'true') query.isHidden = false;

    // Filter out expired achievements
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ];

    const achievements = await Achievement.find(query)
      .sort({ rarity: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Achievement.countDocuments(query);

    res.json({
      achievements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get achievement by ID
router.get('/:achievementId', async (req, res) => {
  try {
    const { achievementId } = req.params;

    const achievement = await Achievement.findById(achievementId);
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    res.json({ achievement });
  } catch (error) {
    console.error('Error fetching achievement:', error);
    res.status(500).json({ error: 'Failed to fetch achievement' });
  }
});

// Create new achievement (admin only)
router.post('/', requireAuth, async (req, res) => {
  try {
    const achievementData = createAchievementSchema.parse(req.body);
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const achievement = new Achievement(achievementData);
    await achievement.save();

    res.status(201).json({
      message: 'Achievement created successfully',
      achievement,
    });
  } catch (error) {
    console.error('Error creating achievement:', error);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
});

// Update achievement (admin only)
router.patch('/:achievementId', requireAuth, async (req, res) => {
  try {
    const { achievementId } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const achievement = await Achievement.findByIdAndUpdate(
      achievementId,
      updates,
      { new: true }
    );

    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    res.json({
      message: 'Achievement updated successfully',
      achievement,
    });
  } catch (error) {
    console.error('Error updating achievement:', error);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

// Delete achievement (admin only)
router.delete('/:achievementId', requireAuth, async (req, res) => {
  try {
    const { achievementId } = req.params;
    const userId = req.user.id;

    // Check if user is admin
    const user = await User.findById(userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const achievement = await Achievement.findByIdAndDelete(achievementId);
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    // Remove achievement from all users who have it
    await User.updateMany(
      { achievements: achievementId },
      { $pull: { achievements: achievementId } }
    );

    res.json({
      message: 'Achievement deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting achievement:', error);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

// Get user's achievements
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('achievements');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const achievements = await Achievement.find({
      _id: { $in: user.achievements }
    });

    // Get achievement progress for incomplete achievements
    const allAchievements = await Achievement.find({
      isActive: true,
      isHidden: false,
      _id: { $nin: user.achievements }
    });

    const progress = await Promise.all(
      allAchievements.map(async (achievement) => {
        const progress = await calculateAchievementProgress(userId, achievement);
        return {
          achievement,
          progress,
          isCompleted: false,
        };
      })
    );

    res.json({
      completedAchievements: achievements,
      inProgressAchievements: progress,
      totalCompleted: achievements.length,
      totalPossible: achievements.length + progress.length,
      completionPercentage: Math.round((achievements.length / (achievements.length + progress.length)) * 100),
    });
  } catch (error) {
    console.error('Error fetching user achievements:', error);
    res.status(500).json({ error: 'Failed to fetch user achievements' });
  }
});

// Award achievement to user (admin/moderator only)
router.post('/award/:achievementId/:userId', requireAuth, async (req, res) => {
  try {
    const { achievementId, userId } = req.params;
    const adminUserId = req.user.id;

    // Check if user is admin or moderator
    const adminUser = await User.findById(adminUserId);
    if (!adminUser || !['admin', 'moderator'].includes(adminUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const achievement = await Achievement.findById(achievementId);
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has this achievement
    if (user.achievements.includes(achievementId)) {
      return res.status(400).json({ error: 'User already has this achievement' });
    }

    // Award achievement
    user.achievements.push(achievementId);
    user.experience += achievement.rewards.experience || 0;
    user.karma += achievement.rewards.karma || 0;
    
    await user.save();

    // Update achievement statistics
    achievement.totalEarned += 1;
    await achievement.save();

    // Send notification
    await notificationService.createAchievementNotification(userId, achievementId);

    // Log the action
    adminUser.auditLog.push({
      action: 'achievement_awarded',
      details: `Awarded achievement "${achievement.name}" to user ${userId}`,
      timestamp: new Date(),
    });
    await adminUser.save();

    res.json({
      message: 'Achievement awarded successfully',
      achievement,
      userExperience: user.experience,
      userKarma: user.karma,
    });
  } catch (error) {
    console.error('Error awarding achievement:', error);
    res.status(500).json({ error: 'Failed to award achievement' });
  }
});

// Get achievement statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await Achievement.aggregate([
      {
        $group: {
          _id: null,
          totalAchievements: { $sum: 1 },
          activeAchievements: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          },
          hiddenAchievements: {
            $sum: {
              $cond: [{ $eq: ['$isActive', true] }, 1, 0]
            }
          },
          totalEarned: { $sum: '$totalEarned' },
          averageEarnedPerAchievement: { $avg: '$totalEarned' },
        },
      },
    ]);

    const categoryStats = await Achievement.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalEarned: { $sum: '$totalEarned' },
        },
      },
    ]);

    const rarityStats = await Achievement.aggregate([
      {
        $group: {
          _id: '$rarity',
          count: { $sum: 1 },
          totalEarned: { $sum: '$totalEarned' },
        },
      },
    ]);

    res.json({
      overview: stats[0] || {
        totalAchievements: 0,
        activeAchievements: 0,
        hiddenAchievements: 0,
        totalEarned: 0,
        averageEarnedPerAchievement: 0,
      },
      categoryStats,
      rarityStats,
    });
  } catch (error) {
    console.error('Error fetching achievement stats:', error);
    res.status(500).json({ error: 'Failed to fetch achievement stats' });
  }
});

// Get leaderboard for achievements
router.get('/leaderboard/most-achievements', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topUsers = await User.aggregate([
      {
        $project: {
          displayName: 1,
          avatarUrl: 1,
          achievementCount: { $size: '$achievements' },
          karma: 1,
          level: 1,
        },
      },
      { $sort: { achievementCount: -1, karma: -1 } },
      { $limit: parseInt(limit) },
    ]);

    res.json({
      leaderboard: topUsers.map((user, index) => ({
        rank: index + 1,
        id: user._id,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        achievementCount: user.achievementCount,
        karma: user.karma,
        level: user.level,
      })),
    });
  } catch (error) {
    console.error('Error fetching achievement leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch achievement leaderboard' });
  }
});

// Helper function to calculate achievement progress
async function calculateAchievementProgress(userId, achievement) {
  try {
    const user = await User.findById(userId);
    if (!user) return 0;

    const { type, requirements } = achievement;
    let currentValue = 0;
    let maxValue = requirements.value;

    switch (type) {
      case 'message_count':
        // Count user's messages (would need to query Message collection)
        currentValue = 0; // Placeholder
        break;
      case 'friend_count':
        currentValue = user.friends ? user.friends.length : 0;
        break;
      case 'karma':
        currentValue = user.karma || 0;
        break;
      case 'level':
        currentValue = user.level || 1;
        break;
      default:
        currentValue = 0;
    }

    return Math.min(Math.round((currentValue / maxValue) * 100), 100);
  } catch (error) {
    console.error('Error calculating achievement progress:', error);
    return 0;
  }
}

export { router as achievementsRouter };
