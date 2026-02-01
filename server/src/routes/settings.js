import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { User } from '../models/User.js';
import { z } from 'zod';

export const settingsRouter = express.Router();

// Settings validation schema
const settingsSchema = z.object({
  // Privacy Settings
  profileVisibility: z.enum(['public', 'friends', 'private']).optional(),
  showAgeGender: z.boolean().optional(),
  allowRandomChat: z.boolean().optional(),
  friendRequestPreference: z.enum(['anyone', 'friends_of_friends', 'no_one']).optional(),

  // Notification Settings
  messageNotifications: z.boolean().optional(),
  friendRequestNotifications: z.boolean().optional(),
  soundEffects: z.boolean().optional(),
  desktopNotifications: z.boolean().optional(),

  // Chat Settings
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  timestampFormat: z.enum(['12h', '24h']).optional(),
  saveMessageHistory: z.boolean().optional(),
  autoScroll: z.boolean().optional(),

  // Appearance Settings
  colorScheme: z.enum(['default', 'blue', 'green', 'purple', 'red']).optional(),
  chatBubbleStyle: z.enum(['default', 'rounded', 'sharp']).optional(),
  avatarSize: z.enum(['small', 'medium', 'large']).optional(),
});

// Get all settings
settingsRouter.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference ' +
      'messageNotifications friendRequestNotifications soundEffects desktopNotifications ' +
      'theme fontSize timestampFormat saveMessageHistory autoScroll ' +
      'colorScheme chatBubbleStyle avatarSize'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      settings: {
        // Privacy Settings
        profileVisibility: user.profileVisibility,
        showAgeGender: user.showAgeGender,
        allowRandomChat: user.allowRandomChat,
        friendRequestPreference: user.friendRequestPreference,

        // Notification Settings
        messageNotifications: user.messageNotifications,
        friendRequestNotifications: user.friendRequestNotifications,
        soundEffects: user.soundEffects,
        desktopNotifications: user.desktopNotifications,

        // Chat Settings
        theme: user.theme,
        fontSize: user.fontSize,
        timestampFormat: user.timestampFormat,
        saveMessageHistory: user.saveMessageHistory,
        autoScroll: user.autoScroll,

        // Appearance Settings
        colorScheme: user.colorScheme,
        chatBubbleStyle: user.chatBubbleStyle,
        avatarSize: user.avatarSize,
      },
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
settingsRouter.put('/', requireAuth, async (req, res) => {
  try {
    const validatedData = settingsSchema.parse(req.body);
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: validatedData },
      { new: true, runValidators: true }
    ).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference ' +
      'messageNotifications friendRequestNotifications soundEffects desktopNotifications ' +
      'theme fontSize timestampFormat saveMessageHistory autoScroll ' +
      'colorScheme chatBubbleStyle avatarSize'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      settings: {
        // Privacy Settings
        profileVisibility: user.profileVisibility,
        showAgeGender: user.showAgeGender,
        allowRandomChat: user.allowRandomChat,
        friendRequestPreference: user.friendRequestPreference,

        // Notification Settings
        messageNotifications: user.messageNotifications,
        friendRequestNotifications: user.friendRequestNotifications,
        soundEffects: user.soundEffects,
        desktopNotifications: user.desktopNotifications,

        // Chat Settings
        theme: user.theme,
        fontSize: user.fontSize,
        timestampFormat: user.timestampFormat,
        saveMessageHistory: user.saveMessageHistory,
        autoScroll: user.autoScroll,

        // Appearance Settings
        colorScheme: user.colorScheme,
        chatBubbleStyle: user.chatBubbleStyle,
        avatarSize: user.avatarSize,
      },
      message: 'Settings updated successfully',
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid settings data', details: error.errors });
    }
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Reset settings to defaults
settingsRouter.post('/reset', requireAuth, async (req, res) => {
  try {
    const defaultSettings = {
      // Privacy Settings
      profileVisibility: 'public',
      showAgeGender: true,
      allowRandomChat: true,
      friendRequestPreference: 'anyone',

      // Notification Settings
      messageNotifications: true,
      friendRequestNotifications: true,
      soundEffects: true,
      desktopNotifications: false,

      // Chat Settings
      theme: 'auto',
      fontSize: 'medium',
      timestampFormat: '12h',
      saveMessageHistory: true,
      autoScroll: true,

      // Appearance Settings
      colorScheme: 'default',
      chatBubbleStyle: 'default',
      avatarSize: 'medium',
    };

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: defaultSettings },
      { new: true, runValidators: true }
    ).select(
      'profileVisibility showAgeGender allowRandomChat friendRequestPreference ' +
      'messageNotifications friendRequestNotifications soundEffects desktopNotifications ' +
      'theme fontSize timestampFormat saveMessageHistory autoScroll ' +
      'colorScheme chatBubbleStyle avatarSize'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      settings: defaultSettings,
      message: 'Settings reset to defaults',
    });
  } catch (error) {
    console.error('Reset settings error:', error);
    res.status(500).json({ error: 'Failed to reset settings' });
  }
});
