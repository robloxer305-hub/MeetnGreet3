import webpush from 'web-push';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { Achievement } from '../models/Achievement.js';

// Configure Web Push (these should be in environment variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_EMAIL = process.env.VAPID_EMAIL || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${VAPID_EMAIL}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

class NotificationService {
  // Create a notification in database
  async createNotification(data) {
    try {
      const notification = new Notification(data);
      await notification.save();
      
      // Send push notification if enabled
      if (notification.channels.push && !notification.isPushed) {
        await this.sendPushNotification(notification);
      }
      
      // Send email notification if enabled
      if (notification.channels.email && !notification.isEmailSent) {
        await this.sendEmailNotification(notification);
      }
      
      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Send push notification via Web Push API
  async sendPushNotification(notification) {
    try {
      const user = await User.findById(notification.recipient);
      if (!user || !user.pushNotifications) {
        return;
      }

      // Get user's push subscriptions (this would be stored in user model)
      const subscriptions = user.pushSubscriptions || [];
      
      const payload = JSON.stringify({
        title: notification.title,
        message: notification.message,
        icon: notification.icon || '/icon-192x192.png',
        badge: notification.icon || '/icon-192x192.png',
        tag: notification._id.toString(),
        data: {
          notificationId: notification._id.toString(),
          type: notification.type,
          ...notification.data,
        },
        actions: notification.actions,
      });

      // Send to all subscriptions
      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, payload);
          return { success: true, subscription };
        } catch (error) {
          console.error('Failed to send push notification:', error);
          
          // Remove invalid subscription
          if (error.statusCode === 410) {
            await User.findByIdAndUpdate(notification.recipient, {
              $pull: { pushSubscriptions: subscription },
            });
          }
          
          return { success: false, error, subscription };
        }
      });

      const results = await Promise.allSettled(sendPromises);
      
      // Mark notification as pushed
      await Notification.findByIdAndUpdate(notification._id, {
        isPushed: true,
        pushedAt: new Date(),
        'deliveryStatus.push': 'delivered',
      });

      return results;
    } catch (error) {
      console.error('Error sending push notification:', error);
      
      // Mark as failed
      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.push': 'failed',
      });
      
      throw error;
    }
  }

  // Send email notification
  async sendEmailNotification(notification) {
    try {
      const user = await User.findById(notification.recipient);
      if (!user || !user.emailNotifications) {
        return;
      }

      // This would integrate with an email service like SendGrid, Nodemailer, etc.
      // For now, we'll just mark it as sent
      console.log('Email notification would be sent:', {
        to: user.email,
        subject: notification.title,
        body: notification.message,
      });

      await Notification.findByIdAndUpdate(notification._id, {
        isEmailSent: true,
        emailSentAt: new Date(),
        'deliveryStatus.email': 'delivered',
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending email notification:', error);
      
      await Notification.findByIdAndUpdate(notification._id, {
        'deliveryStatus.email': 'failed',
      });
      
      throw error;
    }
  }

  // Create message notification
  async createMessageNotification(message, recipientId) {
    const sender = await User.findById(message.from);
    const recipient = await User.findById(recipientId);

    if (!recipient || !recipient.messageNotifications) {
      return;
    }

    let title = 'New Message';
    let messageText = message.text;

    if (message.kind === 'private') {
      title = `Message from ${sender.displayName}`;
    } else if (message.kind === 'public') {
      title = 'New Public Message';
    } else if (message.kind === 'group') {
      title = `Group Message`;
    }

    // Truncate message if too long
    if (messageText.length > 100) {
      messageText = messageText.substring(0, 97) + '...';
    }

    return this.createNotification({
      recipient: recipientId,
      sender: message.from,
      type: 'message',
      title,
      message: messageText,
      data: {
        messageId: message._id,
        kind: message.kind,
      },
      channels: {
        inApp: true,
        push: recipient.pushNotifications,
        email: recipient.emailNotifications,
      },
      priority: message.priority || 'normal',
    });
  }

  // Create friend request notification
  async createFriendRequestNotification(fromUserId, toUserId) {
    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!toUser || !toUser.friendRequestNotifications) {
      return;
    }

    return this.createNotification({
      recipient: toUserId,
      sender: fromUserId,
      type: 'friend_request',
      title: 'Friend Request',
      message: `${fromUser.displayName} wants to be your friend`,
      data: {
        userId: fromUserId,
      },
      channels: {
        inApp: true,
        push: toUser.pushNotifications,
        email: toUser.emailNotifications,
      },
      actions: [
        {
          type: 'accept',
          label: 'Accept',
          action: 'accept_friend_request',
        },
        {
          type: 'reject',
          label: 'Reject',
          action: 'reject_friend_request',
        },
      ],
    });
  }

  // Create achievement notification
  async createAchievementNotification(userId, achievementId) {
    const user = await User.findById(userId);
    const achievement = await Achievement.findById(achievementId);

    if (!user || !achievement) {
      return;
    }

    return this.createNotification({
      recipient: userId,
      type: 'achievement',
      title: 'Achievement Unlocked!',
      message: `You've earned the "${achievement.name}" achievement!`,
      data: {
        achievementId,
      },
      channels: {
        inApp: true,
        push: user.pushNotifications,
        email: user.emailNotifications,
      },
      priority: 'high',
      icon: achievement.icon,
    });
  }

  // Get notifications for user
  async getUserNotifications(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      unreadOnly = false,
      type = null,
    } = options;

    const query = { recipient: userId };
    
    if (unreadOnly) {
      query.isRead = false;
    }
    
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'displayName avatarUrl')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Notification.countDocuments(query);

    return {
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { 
        isRead: true, 
        readAt: new Date(),
        $inc: { clickCount: 1 },
        lastClickedAt: new Date(),
      },
      { new: true }
    );

    return notification;
  }

  // Mark all notifications as read for user
  async markAllAsRead(userId) {
    await Notification.updateMany(
      { recipient: userId, isRead: false },
      { 
        isRead: true, 
        readAt: new Date(),
      }
    );

    return { success: true };
  }

  // Delete notification
  async deleteNotification(notificationId, userId) {
    const result = await Notification.deleteOne({
      _id: notificationId,
      recipient: userId,
    });

    return result.deletedCount > 0;
  }
}

export const notificationService = new NotificationService();
