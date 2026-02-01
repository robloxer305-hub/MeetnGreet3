import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Follow a user
router.post('/:userId/follow', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    if (userId === followerId) {
      return res.status(400).json({ error: 'Cannot follow yourself' });
    }

    const [userToFollow, follower] = await Promise.all([
      User.findById(userId),
      User.findById(followerId),
    ]);

    if (!userToFollow || !follower) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already following
    if (follower.following.includes(userId)) {
      return res.status(400).json({ error: 'Already following this user' });
    }

    // Check if blocked
    if (userToFollow.blockedUsers.includes(followerId)) {
      return res.status(403).json({ error: 'Cannot follow this user' });
    }

    // Check privacy settings
    if (!userToFollow.allowFriendRequests && userToFollow.profileVisibility === 'private') {
      return res.status(403).json({ error: 'This user does not allow followers' });
    }

    // Add to following/followers
    follower.following.push(userId);
    userToFollow.followers.push(followerId);

    await Promise.all([
      follower.save(),
      userToFollow.save(),
    ]);

    // Send notification to user being followed
    await notificationService.createNotification({
      recipient: userId,
      sender: followerId,
      type: 'social',
      title: 'New Follower',
      message: `${follower.displayName} started following you`,
      data: {
        userId: followerId,
      },
      channels: {
        inApp: true,
        push: userToFollow.pushNotifications,
      },
    });

    // Log the action
    follower.auditLog.push({
      action: 'user_followed',
      details: `Started following user ${userId}`,
      timestamp: new Date(),
    });
    await follower.save();

    res.json({
      message: 'User followed successfully',
      following: {
        id: userToFollow._id,
        displayName: userToFollow.displayName,
        avatarUrl: userToFollow.avatarUrl,
        followersCount: userToFollow.followers.length,
      },
    });
  } catch (error) {
    console.error('Error following user:', error);
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// Unfollow a user
router.post('/:userId/unfollow', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const followerId = req.user.id;

    const [userToUnfollow, follower] = await Promise.all([
      User.findById(userId),
      User.findById(followerId),
    ]);

    if (!userToUnfollow || !follower) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if following
    if (!follower.following.includes(userId)) {
      return res.status(400).json({ error: 'Not following this user' });
    }

    // Remove from following/followers
    follower.following.pull(userId);
    userToUnfollow.followers.pull(followerId);

    await Promise.all([
      follower.save(),
      userToUnfollow.save(),
    ]);

    // Log the action
    follower.auditLog.push({
      action: 'user_unfollowed',
      details: `Stopped following user ${userId}`,
      timestamp: new Date(),
    });
    await follower.save();

    res.json({
      message: 'User unfollowed successfully',
    });
  } catch (error) {
    console.error('Error unfollowing user:', error);
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// Get user's followers
router.get('/:userId/followers', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId)
      .populate({
        path: 'followers',
        select: 'displayName avatarUrl karma reputation level',
        options: {
          skip: (page - 1) * limit,
          limit: parseInt(limit),
        },
      });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const total = user.followers.length;

    res.json({
      followers: user.followers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching followers:', error);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// Get user's following
router.get('/:userId/following', async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const user = await User.findById(userId)
      .populate({
        path: 'following',
        select: 'displayName avatarUrl karma reputation level',
        options: {
          skip: (page - 1) * limit,
          limit: parseInt(limit),
        },
      });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const total = user.following.length;

    res.json({
      following: user.following,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching following:', error);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});

// Check if following
router.get('/:userId/follow-status', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isFollowing = currentUser.following.includes(userId);
    const isMutual = isFollowing && currentUser.followers.includes(userId);

    res.json({
      isFollowing,
      isMutual,
      followDate: isFollowing ? currentUser.auditLog
        .filter(log => log.action === 'user_followed' && log.details.includes(userId))
        .map(log => log.timestamp)[0] : null,
    });
  } catch (error) {
    console.error('Error checking follow status:', error);
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// Get follow suggestions
router.get('/suggestions', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get users not already followed or blocked
    const excludedIds = [
      ...currentUser.following,
      ...currentUser.friends,
      ...currentUser.blockedUsers,
      userId,
    ];

    // Find users with similar interests or friends of friends
    const suggestions = await User.find({
      _id: { $nin: excludedIds },
      profileVisibility: 'public',
    })
    .select('displayName avatarUrl bio interests karma reputation')
    .sort({ karma: -1 })
    .limit(parseInt(limit));

    // Score suggestions based on mutual interests and friends
    const scoredSuggestions = suggestions.map(user => {
      let score = 0;
      
      // Score based on mutual interests
      const mutualInterests = user.interests.filter(interest => 
        currentUser.interests.includes(interest)
      ).length;
      score += mutualInterests * 10;
      
      // Score based on karma
      score += Math.min(user.karma / 10, 50);
      
      // Score based on reputation
      score += user.reputation * 5;
      
      return {
        ...user.toObject(),
        score,
        mutualInterests,
      };
    });

    // Sort by score and return top suggestions
    scoredSuggestions.sort((a, b) => b.score - a.score);

    res.json({
      suggestions: scoredSuggestions.slice(0, parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching follow suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch follow suggestions' });
  }
});

// Get follow statistics
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const stats = {
      followersCount: user.followers.length,
      followingCount: user.following.length,
      friendsCount: user.friends.length,
      followRatio: user.following.length > 0 ? 
        (user.followers.length / user.following.length).toFixed(2) : 0,
    };

    // Add detailed stats for own profile
    if (req.user && userId === req.user.id) {
      stats.pendingFollowRequests = 0; // Would need follow requests model
      stats.recentFollowers = user.followers.slice(-5);
      stats.recentFollowing = user.following.slice(-5);
    }

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching follow stats:', error);
    res.status(500).json({ error: 'Failed to fetch follow stats' });
  }
});

// Remove follower (unfollow someone who follows you)
router.post('/:userId/remove-follower', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const [currentUser, follower] = await Promise.all([
      User.findById(currentUserId),
      User.findById(userId),
    ]);

    if (!currentUser || !follower) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this user follows current user
    if (!currentUser.followers.includes(userId)) {
      return res.status(400).json({ error: 'This user does not follow you' });
    }

    // Remove from followers/following
    currentUser.followers.pull(userId);
    follower.following.pull(currentUserId);

    await Promise.all([
      currentUser.save(),
      follower.save(),
    ]);

    // Log the action
    currentUser.auditLog.push({
      action: 'follower_removed',
      details: `Removed follower ${userId}`,
      timestamp: new Date(),
    });
    await currentUser.save();

    res.json({
      message: 'Follower removed successfully',
    });
  } catch (error) {
    console.error('Error removing follower:', error);
    res.status(500).json({ error: 'Failed to remove follower' });
  }
});

export { router as followRouter };
