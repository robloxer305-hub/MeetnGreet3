import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for updating profile
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
  age: z.number().min(13).max(120).optional(),
  country: z.string().max(100).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  about: z.string().max(1000).optional(),
  bio: z.string().max(500).optional(),
  interests: z.array(z.string().max(50)).max(20).optional(),
  location: z.string().max(100).optional(),
  website: z.string().url().optional(),
  socialLinks: z.object({
    twitter: z.string().max(100).optional(),
    instagram: z.string().max(100).optional(),
    github: z.string().max(100).optional(),
  }).optional(),
});

// Schema for privacy settings
const privacySchema = z.object({
  profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
  showAgeGender: z.boolean().optional(),
  allowRandomChat: z.boolean().optional(),
  friendRequestPreference: z.enum(['anyone', 'friends_of_friends', 'no_one']).optional(),
  allowPrivateMessages: z.boolean().optional(),
  allowFriendRequests: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
  allowLocationSharing: z.boolean().optional(),
});

// Get public profile
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;

    const user = await User.findById(userId)
      .select('-passwordHash -twoFactorSecret -backupCodes -passwordResetToken -emailVerificationToken')
      .populate('friends', 'displayName avatarUrl')
      .populate('followers', 'displayName avatarUrl')
      .populate('following', 'displayName avatarUrl')
      .populate('achievements', 'name icon badgeColor');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy settings
    const isOwnProfile = userId === requestingUserId;
    const isFriend = requestingUserId && user.friends.some(friend => friend._id.toString() === requestingUserId);
    const canViewPrivate = isOwnProfile || isFriend;

    // Build profile based on privacy settings
    const profile = {
      id: user._id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      interests: user.interests,
      location: user.location,
      website: user.website,
      socialLinks: user.socialLinks,
      reputation: user.reputation,
      karma: user.karma,
      level: user.level,
      experience: user.experience,
      achievements: user.achievements,
      achievementCount: user.achievements.length,
      friendsCount: user.friends.length,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      onlineStatus: user.onlineStatus,
    };

    // Add sensitive info based on privacy settings
    if (user.profileVisibility === 'public' || canViewPrivate) {
      profile.about = user.about;
      profile.age = user.showAgeGender ? user.age : null;
      profile.gender = user.showAgeGender ? user.gender : null;
      profile.country = user.country;
    }

    // Add online status if allowed
    if (user.showOnlineStatus || isOwnProfile) {
      profile.onlineStatus = user.onlineStatus;
      profile.lastSeen = user.lastSeen;
    }

    // Add full friend lists for own profile
    if (isOwnProfile) {
      profile.friends = user.friends;
      profile.followers = user.followers;
      profile.following = user.following;
      profile.email = user.email;
      profile.emailVerified = user.emailVerified;
      profile.twoFactorEnabled = user.twoFactorEnabled;
      profile.role = user.role;
    }

    res.json({ profile });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update own profile
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const updates = updateProfileSchema.parse(req.body);
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select('-passwordHash -twoFactorSecret -backupCodes');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      profile: user,
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Update privacy settings
router.patch('/privacy', requireAuth, async (req, res) => {
  try {
    const privacyUpdates = privacySchema.parse(req.body);
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: privacyUpdates },
      { new: true }
    ).select('-passwordHash -twoFactorSecret -backupCodes');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Privacy settings updated successfully',
      privacy: {
        profileVisibility: user.profileVisibility,
        showAgeGender: user.showAgeGender,
        allowRandomChat: user.allowRandomChat,
        friendRequestPreference: user.friendRequestPreference,
        allowPrivateMessages: user.allowPrivateMessages,
        allowFriendRequests: user.allowFriendRequests,
        showOnlineStatus: user.showOnlineStatus,
        allowLocationSharing: user.allowLocationSharing,
      },
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// Get privacy settings
router.get('/privacy/me', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference allowPrivateMessages allowFriendRequests showOnlineStatus allowLocationSharing'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      privacy: {
        profileVisibility: user.profileVisibility,
        showAgeGender: user.showAgeGender,
        allowRandomChat: user.allowRandomChat,
        friendRequestPreference: user.friendRequestPreference,
        allowPrivateMessages: user.allowPrivateMessages,
        allowFriendRequests: user.allowFriendRequests,
        showOnlineStatus: user.showOnlineStatus,
        allowLocationSharing: user.allowLocationSharing,
      },
    });
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    res.status(500).json({ error: 'Failed to fetch privacy settings' });
  }
});

// Upload avatar
router.post('/avatar', requireAuth, async (req, res) => {
  try {
    const { avatarUrl } = req.body;
    const userId = req.user.id;

    if (!avatarUrl) {
      return res.status(400).json({ error: 'Avatar URL is required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { avatarUrl },
      { new: true }
    ).select('displayName avatarUrl');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Avatar updated successfully',
      avatarUrl: user.avatarUrl,
    });
  } catch (error) {
    console.error('Error updating avatar:', error);
    res.status(500).json({ error: 'Failed to update avatar' });
  }
});

// Search profiles
router.get('/search', async (req, res) => {
  try {
    const { 
      q, 
      page = 1, 
      limit = 20, 
      country, 
      gender, 
      minAge, 
      maxAge,
      interests 
    } = req.query;

    let query = {};

    // Build search query
    if (q) {
      query.$or = [
        { displayName: { $regex: q, $options: 'i' } },
        { bio: { $regex: q, $options: 'i' } },
        { interests: { $in: [new RegExp(q, 'i')] } },
      ];
    }

    if (country) query.country = country;
    if (gender) query.gender = gender;
    if (minAge || maxAge) {
      query.age = {};
      if (minAge) query.age.$gte = parseInt(minAge);
      if (maxAge) query.age.$lte = parseInt(maxAge);
    }
    if (interests) {
      const interestArray = Array.isArray(interests) ? interests : [interests];
      query.interests = { $in: interestArray };
    }

    // Only show public profiles in search
    query.profileVisibility = 'public';

    const users = await User.find(query)
      .select('displayName avatarUrl bio interests location karma reputation level createdAt')
      .sort({ karma: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error searching profiles:', error);
    res.status(500).json({ error: 'Failed to search profiles' });
  }
});

// Get profile statistics
router.get('/:userId/stats', async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user?.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check privacy
    const isOwnProfile = userId === requestingUserId;
    const isFriend = requestingUserId && user.friends.includes(requestingUserId);
    const canViewStats = user.profileVisibility === 'public' || isOwnProfile || isFriend;

    if (!canViewStats) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = {
      joinDate: user.createdAt,
      lastSeen: user.lastSeen,
      friendsCount: user.friends.length,
      followersCount: user.followers.length,
      followingCount: user.following.length,
      achievementsCount: user.achievements.length,
      karma: user.karma,
      reputation: user.reputation,
      level: user.level,
      experience: user.experience,
      onlineStatus: user.onlineStatus,
    };

    // Add detailed stats for own profile
    if (isOwnProfile) {
      stats.blockedUsersCount = user.blockedUsers.length;
      stats.mutedUsersCount = user.mutedUsers.length;
      stats.warningCount = user.warnings.length;
      stats.reportCount = user.reports.length;
      stats.auditLogCount = user.auditLog.length;
    }

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching profile stats:', error);
    res.status(500).json({ error: 'Failed to fetch profile stats' });
  }
});

// Get profile activity
router.get('/:userId/activity', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const requestingUserId = req.user.id;

    // Check if user can view this profile's activity
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isOwnProfile = userId === requestingUserId;
    const isFriend = requestingUserId && user.friends.includes(requestingUserId);
    const canViewActivity = user.profileVisibility === 'public' || isOwnProfile || isFriend;

    if (!canViewActivity) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get audit log entries
    const activity = user.auditLog
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice((page - 1) * limit, page * limit)
      .map(entry => ({
        action: entry.action,
        timestamp: entry.timestamp,
        details: entry.details,
      }));

    res.json({
      activity,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: user.auditLog.length,
        pages: Math.ceil(user.auditLog.length / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching profile activity:', error);
    res.status(500).json({ error: 'Failed to fetch profile activity' });
  }
});

export { router as profilesRouter };
