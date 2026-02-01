import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Schema for theme updates
const themeSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']),
});

// Schema for appearance settings
const appearanceSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  fontSize: z.enum(['small', 'medium', 'large']).optional(),
  colorScheme: z.enum(['default', 'blue', 'green', 'purple', 'red']).optional(),
  chatBubbleStyle: z.enum(['default', 'rounded', 'sharp']).optional(),
  avatarSize: z.enum(['small', 'medium', 'large']).optional(),
  chatBackground: z.string().optional(),
  timestampFormat: z.enum(['12h', '24h']).optional(),
});

// Get current theme settings
router.get('/theme', requireAuth, async (req, res) => {
  try {
    const User = (await import('../models/User.js')).User;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      theme: user.theme,
      fontSize: user.fontSize,
      colorScheme: user.colorScheme,
      chatBubbleStyle: user.chatBubbleStyle,
      avatarSize: user.avatarSize,
      chatBackground: user.chatBackground,
      timestampFormat: user.timestampFormat,
    });
  } catch (error) {
    console.error('Error fetching theme settings:', error);
    res.status(500).json({ error: 'Failed to fetch theme settings' });
  }
});

// Update theme
router.patch('/theme', requireAuth, async (req, res) => {
  try {
    const { theme } = themeSchema.parse(req.body);
    const userId = req.user.id;

    const User = (await import('../models/User.js')).User;
    const user = await User.findByIdAndUpdate(
      userId,
      { theme },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Theme updated successfully',
      theme: user.theme,
    });
  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({ error: 'Failed to update theme' });
  }
});

// Update appearance settings
router.patch('/appearance', requireAuth, async (req, res) => {
  try {
    const settings = appearanceSchema.parse(req.body);
    const userId = req.user.id;

    const User = (await import('../models/User.js')).User;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: settings },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Appearance settings updated successfully',
      settings: {
        theme: user.theme,
        fontSize: user.fontSize,
        colorScheme: user.colorScheme,
        chatBubbleStyle: user.chatBubbleStyle,
        avatarSize: user.avatarSize,
        chatBackground: user.chatBackground,
        timestampFormat: user.timestampFormat,
      },
    });
  } catch (error) {
    console.error('Error updating appearance settings:', error);
    res.status(500).json({ error: 'Failed to update appearance settings' });
  }
});

// Upload chat background
router.post('/chat-background', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // This would handle file upload for chat background
    // For now, we'll just accept a URL
    const { imageUrl } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const User = (await import('../models/User.js')).User;
    const user = await User.findByIdAndUpdate(
      userId,
      { chatBackground: imageUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Chat background updated successfully',
      chatBackground: user.chatBackground,
    });
  } catch (error) {
    console.error('Error updating chat background:', error);
    res.status(500).json({ error: 'Failed to update chat background' });
  }
});

// Remove chat background
router.delete('/chat-background', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const User = (await import('../models/User.js')).User;
    const user = await User.findByIdAndUpdate(
      userId,
      { chatBackground: '' },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Chat background removed successfully',
      chatBackground: user.chatBackground,
    });
  } catch (error) {
    console.error('Error removing chat background:', error);
    res.status(500).json({ error: 'Failed to remove chat background' });
  }
});

// Get accessibility settings
router.get('/accessibility', requireAuth, async (req, res) => {
  try {
    const User = (await import('../models/User.js')).User;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      fontSize: user.fontSize,
      timestampFormat: user.timestampFormat,
      soundEffects: user.soundEffects,
      notificationSound: user.notificationSound,
      readReceiptsEnabled: user.readReceiptsEnabled,
      typingIndicatorsEnabled: user.typingIndicatorsEnabled,
    });
  } catch (error) {
    console.error('Error fetching accessibility settings:', error);
    res.status(500).json({ error: 'Failed to fetch accessibility settings' });
  }
});

// Update accessibility settings
router.patch('/accessibility', requireAuth, async (req, res) => {
  try {
    const {
      fontSize,
      timestampFormat,
      soundEffects,
      notificationSound,
      readReceiptsEnabled,
      typingIndicatorsEnabled,
    } = req.body;

    const User = (await import('../models/User.js')).User;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          ...(fontSize && { fontSize }),
          ...(timestampFormat && { timestampFormat }),
          ...(soundEffects !== undefined && { soundEffects }),
          ...(notificationSound && { notificationSound }),
          ...(readReceiptsEnabled !== undefined && { readReceiptsEnabled }),
          ...(typingIndicatorsEnabled !== undefined && { typingIndicatorsEnabled }),
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Accessibility settings updated successfully',
      settings: {
        fontSize: user.fontSize,
        timestampFormat: user.timestampFormat,
        soundEffects: user.soundEffects,
        notificationSound: user.notificationSound,
        readReceiptsEnabled: user.readReceiptsEnabled,
        typingIndicatorsEnabled: user.typingIndicatorsEnabled,
      },
    });
  } catch (error) {
    console.error('Error updating accessibility settings:', error);
    res.status(500).json({ error: 'Failed to update accessibility settings' });
  }
});

export { router as themeRouter };
