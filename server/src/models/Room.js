import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    
    // Room Settings
    isPublic: { type: Boolean, default: true },
    isTemporary: { type: Boolean, default: false },
    maxUsers: { type: Number, default: 100 },
    
    // Room Categories & Topics
    category: { type: String, enum: ['general', 'gaming', 'tech', 'music', 'art', 'sports', 'education', 'business', 'entertainment', 'random', 'adult'], default: 'general' },
    tags: [String],
    topic: { type: String, default: '' },
    
    // Room Management
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Room Statistics
    currentUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    peakUsers: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
    
    // Room Features
    allowFileSharing: { type: Boolean, default: true },
    allowVoiceChat: { type: Boolean, default: false },
    allowVideoChat: { type: Boolean, default: false },
    allowReactions: { type: Boolean, default: true },
    allowPolls: { type: Boolean, default: true },
    
    // Room Moderation
    isLocked: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    autoModeration: { type: Boolean, default: true },
    slowMode: { type: Number, default: 0 }, // seconds between messages, 0 = disabled
    
    // Room Content Filter
    contentFilter: {
      enabled: { type: Boolean, default: true },
      filterLevel: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'medium' },
      blockedWords: [String],
      allowedLinks: { type: Boolean, default: true },
    },
    
    // Room Welcome Message
    welcomeMessage: { type: String, default: '' },
    
    // Room Expiration (for temporary rooms)
    expiresAt: { type: Date },
    isExpired: { type: Boolean, default: false },
    
    // Room Password (for private rooms)
    password: { type: String, default: '' },
    hasPassword: { type: Boolean, default: false },
    
    // Room Analytics
    analytics: {
      messagesPerHour: { type: Number, default: 0 },
      averageUsersPerHour: { type: Number, default: 0 },
      topActiveUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
    
    // Room Customization
    theme: { type: String, enum: ['default', 'dark', 'light', 'custom'], default: 'default' },
    customCSS: { type: String, default: '' },
    emojiSet: { type: String, enum: ['default', 'discord', 'slack', 'custom'], default: 'default' },
    
    // Room Rules
    rules: [{
      title: { type: String, required: true },
      description: { type: String, required: true },
      order: { type: Number, default: 0 },
    }],
    
    // Room Events
    events: [{
      type: { type: String, enum: ['scheduled_chat', 'voice_chat', 'video_chat', 'game_night', 'other'], required: true },
      title: { type: String, required: true },
      description: { type: String, default: '' },
      startTime: { type: Date, required: true },
      endTime: { type: Date },
      maxParticipants: { type: Number, default: 0 }, // 0 = unlimited
      participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      isActive: { type: Boolean, default: true },
    }],
  },
  { timestamps: true }
);

RoomSchema.index({ name: 1 });
RoomSchema.index({ creator: 1 });
RoomSchema.index({ category: 1 });
RoomSchema.index({ isPublic: 1 });
RoomSchema.index({ currentUsers: 1 });
RoomSchema.index({ lastActivity: -1 });
RoomSchema.index({ expiresAt: 1 });

export const Room = mongoose.model('Room', RoomSchema);
