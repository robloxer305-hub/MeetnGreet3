import express from 'express';
import { z } from 'zod';
import { notificationService } from '../services/notificationService.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// Get user notifications
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, unreadOnly, type } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      unreadOnly: unreadOnly === 'true',
      type,
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const notification = await notificationService.markAsRead(notificationId, userId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      message: 'Notification marked as read',
      notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/read-all', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    await notificationService.markAllAsRead(userId);

    res.json({
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:notificationId', requireAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const deleted = await notificationService.deleteNotification(notificationId, userId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get unread notification count
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await notificationService.getUserNotifications(userId, {
      unreadOnly: true,
      limit: 1,
    });

    res.json({
      unreadCount: result.pagination.total,
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Subscribe to push notifications
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription) {
      return res.status(400).json({ error: 'Subscription data is required' });
    }

    // Add subscription to user's push subscriptions
    const User = (await import('../models/User.js')).User;
    await User.findByIdAndUpdate(userId, {
      $addToSet: { pushSubscriptions: subscription },
    });

    res.json({
      message: 'Successfully subscribed to push notifications',
    });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({ error: 'Failed to subscribe to push notifications' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription) {
      return res.status(400).json({ error: 'Subscription data is required' });
    }

    // Remove subscription from user's push subscriptions
    const User = (await import('../models/User.js')).User;
    await User.findByIdAndUpdate(userId, {
      $pull: { pushSubscriptions: subscription },
    });

    res.json({
      message: 'Successfully unsubscribed from push notifications',
    });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ error: 'Failed to unsubscribe from push notifications' });
  }
});

// Get notification settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const User = (await import('../models/User.js')).User;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      messageNotifications: user.messageNotifications,
      friendRequestNotifications: user.friendRequestNotifications,
      pushNotifications: user.pushNotifications,
      emailNotifications: user.emailNotifications,
      desktopNotifications: user.desktopNotifications,
      soundEffects: user.soundEffects,
      notificationSound: user.notificationSound,
    });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

// Update notification settings
router.patch('/settings', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = req.body;

    const User = (await import('../models/User.js')).User;
    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          messageNotifications: settings.messageNotifications,
          friendRequestNotifications: settings.friendRequestNotifications,
          pushNotifications: settings.pushNotifications,
          emailNotifications: settings.emailNotifications,
          desktopNotifications: settings.desktopNotifications,
          soundEffects: settings.soundEffects,
          notificationSound: settings.notificationSound,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Notification settings updated successfully',
      settings: {
        messageNotifications: user.messageNotifications,
        friendRequestNotifications: user.friendRequestNotifications,
        pushNotifications: user.pushNotifications,
        emailNotifications: user.emailNotifications,
        desktopNotifications: user.desktopNotifications,
        soundEffects: user.soundEffects,
        notificationSound: user.notificationSound,
      },
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

export { router as notificationsRouter };
