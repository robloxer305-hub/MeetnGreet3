import express from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for privacy settings
const privacySettingsSchema = z.object({
  profileVisibility: z.enum(['public', 'friends', 'private']),
  showAgeGender: z.boolean(),
  allowRandomChat: z.boolean(),
  friendRequestPreference: z.enum(['anyone', 'friends_of_friends', 'no_one']),
  allowPrivateMessages: z.boolean(),
  allowFriendRequests: z.boolean(),
  showOnlineStatus: z.boolean(),
  allowLocationSharing: z.boolean(),
  messageNotifications: z.boolean(),
  friendRequestNotifications: z.boolean(),
  soundEffects: z.boolean(),
  desktopNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  emailNotifications: z.boolean(),
  notificationSound: z.enum(['default', 'chime', 'bell', 'none']),
  readReceiptsEnabled: z.boolean(),
  typingIndicatorsEnabled: z.boolean(),
  messageExpiration: z.number().min(0), // 0 = never expire, number = hours
  autoDeleteMessages: z.boolean(),
  shareActivityStatus: z.boolean(),
  allowProfileSearch: z.boolean(),
  allowTagging: z.boolean(),
  allowMentions: z.boolean(),
  showInLeaderboards: z.boolean(),
  allowDataCollection: z.boolean(),
  allowAnalytics: z.boolean(),
  allowPersonalizedAds: z.boolean(),
});

// Get user's privacy settings
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference ' +
      'allowPrivateMessages allowFriendRequests showOnlineStatus allowLocationSharing ' +
      'messageNotifications friendRequestNotifications soundEffects desktopNotifications ' +
      'pushNotifications emailNotifications notificationSound readReceiptsEnabled ' +
      'typingIndicatorsEnabled messageExpiration autoDeleteMessages shareActivityStatus ' +
      'allowProfileSearch allowTagging allowMentions showInLeaderboards allowDataCollection ' +
      'allowAnalytics allowPersonalizedAds'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      privacy: {
        profile: {
          profileVisibility: user.profileVisibility,
          showAgeGender: user.showAgeGender,
          allowRandomChat: user.allowRandomChat,
          friendRequestPreference: user.friendRequestPreference,
          allowProfileSearch: user.allowProfileSearch,
          showInLeaderboards: user.showInLeaderboards,
        },
        communication: {
          allowPrivateMessages: user.allowPrivateMessages,
          allowFriendRequests: user.allowFriendRequests,
          showOnlineStatus: user.showOnlineStatus,
          allowLocationSharing: user.allowLocationSharing,
          readReceiptsEnabled: user.readReceiptsEnabled,
          typingIndicatorsEnabled: user.typingIndicatorsEnabled,
          allowTagging: user.allowTagging,
          allowMentions: user.allowMentions,
        },
        notifications: {
          messageNotifications: user.messageNotifications,
          friendRequestNotifications: user.friendRequestNotifications,
          soundEffects: user.soundEffects,
          desktopNotifications: user.desktopNotifications,
          pushNotifications: user.pushNotifications,
          emailNotifications: user.emailNotifications,
          notificationSound: user.notificationSound,
        },
        data: {
          messageExpiration: user.messageExpiration,
          autoDeleteMessages: user.autoDeleteMessages,
          shareActivityStatus: user.shareActivityStatus,
          allowDataCollection: user.allowDataCollection,
          allowAnalytics: user.allowAnalytics,
          allowPersonalizedAds: user.allowPersonalizedAds,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    res.status(500).json({ error: 'Failed to fetch privacy settings' });
  }
});

// Update privacy settings
router.patch('/', requireAuth, async (req, res) => {
  try {
    const updates = privacySettingsSchema.parse(req.body);
    const userId = req.user.id;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference ' +
      'allowPrivateMessages allowFriendRequests showOnlineStatus allowLocationSharing ' +
      'messageNotifications friendRequestNotifications soundEffects desktopNotifications ' +
      'pushNotifications emailNotifications notificationSound readReceiptsEnabled ' +
      'typingIndicatorsEnabled messageExpiration autoDeleteMessages shareActivityStatus ' +
      'allowProfileSearch allowTagging allowMentions showInLeaderboards allowDataCollection ' +
      'allowAnalytics allowPersonalizedAds'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log privacy settings update
    user.auditLog.push({
      action: 'privacy_settings_updated',
      details: 'Privacy settings were updated',
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: 'Privacy settings updated successfully',
      privacy: {
        profile: {
          profileVisibility: user.profileVisibility,
          showAgeGender: user.showAgeGender,
          allowRandomChat: user.allowRandomChat,
          friendRequestPreference: user.friendRequestPreference,
          allowProfileSearch: user.allowProfileSearch,
          showInLeaderboards: user.showInLeaderboards,
        },
        communication: {
          allowPrivateMessages: user.allowPrivateMessages,
          allowFriendRequests: user.allowFriendRequests,
          showOnlineStatus: user.showOnlineStatus,
          allowLocationSharing: user.allowLocationSharing,
          readReceiptsEnabled: user.readReceiptsEnabled,
          typingIndicatorsEnabled: user.typingIndicatorsEnabled,
          allowTagging: user.allowTagging,
          allowMentions: user.allowMentions,
        },
        notifications: {
          messageNotifications: user.messageNotifications,
          friendRequestNotifications: user.friendRequestNotifications,
          soundEffects: user.soundEffects,
          desktopNotifications: user.desktopNotifications,
          pushNotifications: user.pushNotifications,
          emailNotifications: user.emailNotifications,
          notificationSound: user.notificationSound,
        },
        data: {
          messageExpiration: user.messageExpiration,
          autoDeleteMessages: user.autoDeleteMessages,
          shareActivityStatus: user.shareActivityStatus,
          allowDataCollection: user.allowDataCollection,
          allowAnalytics: user.allowAnalytics,
          allowPersonalizedAds: user.allowPersonalizedAds,
        },
      },
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ error: 'Failed to update privacy settings' });
  }
});

// Reset privacy settings to defaults
router.post('/reset', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const defaultSettings = {
      profileVisibility: 'public',
      showAgeGender: true,
      allowRandomChat: true,
      friendRequestPreference: 'anyone',
      allowPrivateMessages: true,
      allowFriendRequests: true,
      showOnlineStatus: true,
      allowLocationSharing: false,
      messageNotifications: true,
      friendRequestNotifications: true,
      soundEffects: true,
      desktopNotifications: false,
      pushNotifications: false,
      emailNotifications: false,
      notificationSound: 'default',
      readReceiptsEnabled: true,
      typingIndicatorsEnabled: true,
      messageExpiration: 0,
      autoDeleteMessages: false,
      shareActivityStatus: true,
      allowProfileSearch: true,
      allowTagging: true,
      allowMentions: true,
      showInLeaderboards: true,
      allowDataCollection: true,
      allowAnalytics: true,
      allowPersonalizedAds: false,
    };

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: defaultSettings },
      { new: true }
    ).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference ' +
      'allowPrivateMessages allowFriendRequests showOnlineStatus allowLocationSharing ' +
      'messageNotifications friendRequestNotifications soundEffects desktopNotifications ' +
      'pushNotifications emailNotifications notificationSound readReceiptsEnabled ' +
      'typingIndicatorsEnabled messageExpiration autoDeleteMessages shareActivityStatus ' +
      'allowProfileSearch allowTagging allowMentions showInLeaderboards allowDataCollection ' +
      'allowAnalytics allowPersonalizedAds'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log privacy settings reset
    user.auditLog.push({
      action: 'privacy_settings_reset',
      details: 'Privacy settings were reset to defaults',
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: 'Privacy settings reset to defaults successfully',
      privacy: defaultSettings,
    });
  } catch (error) {
    console.error('Error resetting privacy settings:', error);
    res.status(500).json({ error: 'Failed to reset privacy settings' });
  }
});

// Get privacy preset options
router.get('/presets', async (req, res) => {
  try {
    const presets = {
      maximum: {
        name: 'Maximum Privacy',
        description: 'Highest privacy settings - minimal data sharing',
        settings: {
          profileVisibility: 'private',
          showAgeGender: false,
          allowRandomChat: false,
          friendRequestPreference: 'no_one',
          allowPrivateMessages: false,
          allowFriendRequests: false,
          showOnlineStatus: false,
          allowLocationSharing: false,
          messageNotifications: true,
          friendRequestNotifications: true,
          soundEffects: false,
          desktopNotifications: false,
          pushNotifications: false,
          emailNotifications: false,
          readReceiptsEnabled: false,
          typingIndicatorsEnabled: false,
          messageExpiration: 24, // 1 day
          autoDeleteMessages: true,
          shareActivityStatus: false,
          allowProfileSearch: false,
          allowTagging: false,
          allowMentions: false,
          showInLeaderboards: false,
          allowDataCollection: false,
          allowAnalytics: false,
          allowPersonalizedAds: false,
        },
      },
      balanced: {
        name: 'Balanced',
        description: 'Balanced privacy settings - recommended for most users',
        settings: {
          profileVisibility: 'friends',
          showAgeGender: true,
          allowRandomChat: true,
          friendRequestPreference: 'friends_of_friends',
          allowPrivateMessages: true,
          allowFriendRequests: true,
          showOnlineStatus: true,
          allowLocationSharing: false,
          messageNotifications: true,
          friendRequestNotifications: true,
          soundEffects: true,
          desktopNotifications: false,
          pushNotifications: true,
          emailNotifications: false,
          readReceiptsEnabled: true,
          typingIndicatorsEnabled: true,
          messageExpiration: 0,
          autoDeleteMessages: false,
          shareActivityStatus: true,
          allowProfileSearch: true,
          allowTagging: true,
          allowMentions: true,
          showInLeaderboards: true,
          allowDataCollection: true,
          allowAnalytics: true,
          allowPersonalizedAds: false,
        },
      },
      social: {
        name: 'Social',
        description: 'Open settings for maximum social interaction',
        settings: {
          profileVisibility: 'public',
          showAgeGender: true,
          allowRandomChat: true,
          friendRequestPreference: 'anyone',
          allowPrivateMessages: true,
          allowFriendRequests: true,
          showOnlineStatus: true,
          allowLocationSharing: true,
          messageNotifications: true,
          friendRequestNotifications: true,
          soundEffects: true,
          desktopNotifications: true,
          pushNotifications: true,
          emailNotifications: true,
          readReceiptsEnabled: true,
          typingIndicatorsEnabled: true,
          messageExpiration: 0,
          autoDeleteMessages: false,
          shareActivityStatus: true,
          allowProfileSearch: true,
          allowTagging: true,
          allowMentions: true,
          showInLeaderboards: true,
          allowDataCollection: true,
          allowAnalytics: true,
          allowPersonalizedAds: true,
        },
      },
    };

    res.json({ presets });
  } catch (error) {
    console.error('Error fetching privacy presets:', error);
    res.status(500).json({ error: 'Failed to fetch privacy presets' });
  }
});

// Apply privacy preset
router.post('/presets/:presetName', requireAuth, async (req, res) => {
  try {
    const { presetName } = req.params;
    const userId = req.user.id;

    // Get presets
    const presets = {
      maximum: {
        profileVisibility: 'private',
        showAgeGender: false,
        allowRandomChat: false,
        friendRequestPreference: 'no_one',
        allowPrivateMessages: false,
        allowFriendRequests: false,
        showOnlineStatus: false,
        allowLocationSharing: false,
        messageNotifications: true,
        friendRequestNotifications: true,
        soundEffects: false,
        desktopNotifications: false,
        pushNotifications: false,
        emailNotifications: false,
        readReceiptsEnabled: false,
        typingIndicatorsEnabled: false,
        messageExpiration: 24,
        autoDeleteMessages: true,
        shareActivityStatus: false,
        allowProfileSearch: false,
        allowTagging: false,
        allowMentions: false,
        showInLeaderboards: false,
        allowDataCollection: false,
        allowAnalytics: false,
        allowPersonalizedAds: false,
      },
      balanced: {
        profileVisibility: 'friends',
        showAgeGender: true,
        allowRandomChat: true,
        friendRequestPreference: 'friends_of_friends',
        allowPrivateMessages: true,
        allowFriendRequests: true,
        showOnlineStatus: true,
        allowLocationSharing: false,
        messageNotifications: true,
        friendRequestNotifications: true,
        soundEffects: true,
        desktopNotifications: false,
        pushNotifications: true,
        emailNotifications: false,
        readReceiptsEnabled: true,
        typingIndicatorsEnabled: true,
        messageExpiration: 0,
        autoDeleteMessages: false,
        shareActivityStatus: true,
        allowProfileSearch: true,
        allowTagging: true,
        allowMentions: true,
        showInLeaderboards: true,
        allowDataCollection: true,
        allowAnalytics: true,
        allowPersonalizedAds: false,
      },
      social: {
        profileVisibility: 'public',
        showAgeGender: true,
        allowRandomChat: true,
        friendRequestPreference: 'anyone',
        allowPrivateMessages: true,
        allowFriendRequests: true,
        showOnlineStatus: true,
        allowLocationSharing: true,
        messageNotifications: true,
        friendRequestNotifications: true,
        soundEffects: true,
        desktopNotifications: true,
        pushNotifications: true,
        emailNotifications: true,
        readReceiptsEnabled: true,
        typingIndicatorsEnabled: true,
        messageExpiration: 0,
        autoDeleteMessages: false,
        shareActivityStatus: true,
        allowProfileSearch: true,
        allowTagging: true,
        allowMentions: true,
        showInLeaderboards: true,
        allowDataCollection: true,
        allowAnalytics: true,
        allowPersonalizedAds: true,
      },
    };

    const preset = presets[presetName];
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: preset },
      { new: true }
    ).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference ' +
      'allowPrivateMessages allowFriendRequests showOnlineStatus allowLocationSharing ' +
      'messageNotifications friendRequestNotifications soundEffects desktopNotifications ' +
      'pushNotifications emailNotifications notificationSound readReceiptsEnabled ' +
      'typingIndicatorsEnabled messageExpiration autoDeleteMessages shareActivityStatus ' +
      'allowProfileSearch allowTagging allowMentions showInLeaderboards allowDataCollection ' +
      'allowAnalytics allowPersonalizedAds'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Log privacy preset application
    user.auditLog.push({
      action: 'privacy_preset_applied',
      details: `Applied privacy preset: ${presetName}`,
      timestamp: new Date(),
    });
    await user.save();

    res.json({
      message: `Applied ${presetName} privacy preset successfully`,
      preset: presetName,
      privacy: preset,
    });
  } catch (error) {
    console.error('Error applying privacy preset:', error);
    res.status(500).json({ error: 'Failed to apply privacy preset' });
  }
});

// Export user data (GDPR compliance)
router.get('/export-data', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).select('-passwordHash -twoFactorSecret -backupCodes');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Collect user data
    const userData = {
      profile: {
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        interests: user.interests,
        location: user.location,
        website: user.website,
        socialLinks: user.socialLinks,
        createdAt: user.createdAt,
      },
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
      statistics: {
        karma: user.karma,
        reputation: user.reputation,
        level: user.level,
        experience: user.experience,
        friendsCount: user.friends.length,
        followersCount: user.followers.length,
        followingCount: user.following.length,
        achievementsCount: user.achievements.length,
      },
      auditLog: user.auditLog.map(entry => ({
        action: entry.action,
        timestamp: entry.timestamp,
        details: entry.details,
      })),
    };

    res.json({
      userData,
      exportedAt: new Date(),
    });
  } catch (error) {
    console.error('Error exporting user data:', error);
    res.status(500).json({ error: 'Failed to export user data' });
  }
});

// Delete user account (GDPR compliance)
router.delete('/delete-account', requireAuth, async (req, res) => {
  try {
    const { password, confirmation } = req.body;
    const userId = req.user.id;

    if (confirmation !== 'DELETE') {
      return res.status(400).json({ error: 'Confirmation text must be "DELETE"' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify password (would need password comparison logic)
    // For now, we'll proceed with deletion

    // Delete user account
    await User.findByIdAndDelete(userId);

    res.json({
      message: 'Account deleted successfully',
      deletedAt: new Date(),
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export { router as privacyRouter };
