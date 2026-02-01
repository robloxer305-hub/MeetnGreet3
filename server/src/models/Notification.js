import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Notification Content
    type: { type: String, enum: ['message', 'friend_request', 'friend_accepted', 'mention', 'reaction', 'achievement', 'system', 'moderation', 'group_invite', 'announcement'], required: true },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    
    // Notification Data
    data: {
      messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
      groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
      roomId: { type: String },
      achievementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    
    // Notification Status
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    isPushed: { type: Boolean, default: false },
    pushedAt: { type: Date },
    
    // Notification Priority
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    
    // Notification Channels
    channels: {
      inApp: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      email: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
    },
    
    // Notification Actions
    actions: [{
      type: { type: String, enum: ['accept', 'reject', 'view', 'reply', 'delete'], required: true },
      label: { type: String, required: true },
      url: { type: String, default: '' },
      action: { type: String, default: '' },
    }],
    
    // Notification Expiration
    expiresAt: { type: Date },
    isExpired: { type: Boolean, default: false },
    
    // Notification Metadata
    category: { type: String, enum: ['social', 'system', 'moderation', 'achievement', 'announcement'], default: 'social' },
    icon: { type: String, default: '' },
    color: { type: String, default: '#007bff' },
    
    // Notification Delivery Status
    deliveryStatus: {
      inApp: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'delivered' },
      push: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
      email: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
      sms: { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending' },
    },
    
    // Notification Tracking
    clickCount: { type: Number, default: 0 },
    lastClickedAt: { type: Date },
    
    // Notification Settings Override
    userSettingsOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
NotificationSchema.index({ sender: 1 });

export const Notification = mongoose.model('Notification', NotificationSchema);
