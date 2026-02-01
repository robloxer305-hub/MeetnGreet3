import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },

    displayName: { type: String, required: true },
    avatarUrl: { type: String, default: '' },

    age: { type: Number, default: null },
    country: { type: String, default: '' },
    gender: { type: String, default: '' },
    about: { type: String, default: '' },

    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Privacy Settings
    profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'public' },
    showAgeGender: { type: Boolean, default: true },
    allowRandomChat: { type: Boolean, default: true },
    friendRequestPreference: { type: String, enum: ['anyone', 'friends_of_friends', 'no_one'], default: 'anyone' },
    allowPrivateMessages: { type: Boolean, default: true },
    allowFriendRequests: { type: Boolean, default: true },
    showOnlineStatus: { type: Boolean, default: true },
    allowLocationSharing: { type: Boolean, default: false },

    // Notification Settings
    messageNotifications: { type: Boolean, default: true },
    friendRequestNotifications: { type: Boolean, default: true },
    soundEffects: { type: Boolean, default: true },
    desktopNotifications: { type: Boolean, default: false },
    pushNotifications: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: false },
    notificationSound: { type: String, enum: ['default', 'chime', 'bell', 'none'], default: 'default' },

    // Chat Settings
    theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
    fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
    timestampFormat: { type: String, enum: ['12h', '24h'], default: '12h' },
    saveMessageHistory: { type: Boolean, default: true },
    autoScroll: { type: Boolean, default: true },
    chatBackground: { type: String, default: '' },
    readReceiptsEnabled: { type: Boolean, default: true },
    typingIndicatorsEnabled: { type: Boolean, default: true },
    messageExpiration: { type: Number, default: 0 }, // 0 = never expire, number = hours

    // Appearance Settings
    colorScheme: { type: String, enum: ['default', 'blue', 'green', 'purple', 'red'], default: 'default' },
    chatBubbleStyle: { type: String, enum: ['default', 'rounded', 'sharp'], default: 'default' },
    avatarSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },

    // Online Status
    onlineStatus: { type: String, enum: ['online', 'away', 'offline', 'invisible'], default: 'offline' },
    lastSeen: { type: Date, default: Date.now },
    isTyping: { type: Boolean, default: false },
    currentRoom: { type: String, default: '' },

    // Security
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: '' },
    backupCodes: [String],
    passwordResetToken: { type: String, default: '' },
    passwordResetExpires: { type: Date },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, default: '' },

    // Profile Enhancement
    bio: { type: String, default: '', maxlength: 500 },
    interests: [String],
    location: { type: String, default: '' },
    website: { type: String, default: '' },
    socialLinks: {
      twitter: { type: String, default: '' },
      instagram: { type: String, default: '' },
      github: { type: String, default: '' },
    },

    // Social Features
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    // Reputation & Achievements
    karma: { type: Number, default: 0 },
    reputation: { type: Number, default: 0 },
    achievements: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' }],
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },

    // User Role
    role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
    permissions: [String],

    // Moderation
    isBanned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    banExpires: { type: Date },
    warnings: [{
      reason: { type: String, required: true },
      issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      issuedAt: { type: Date, default: Date.now },
    }],
    reports: [{
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      reason: { type: String, required: true },
      description: { type: String, default: '' },
      createdAt: { type: Date, default: Date.now },
      status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending' },
    }],

    // Device & Session Management
    devices: [{
      deviceId: { type: String, required: true },
      deviceType: { type: String, enum: ['web', 'mobile', 'desktop'], required: true },
      userAgent: { type: String, default: '' },
      lastActive: { type: Date, default: Date.now },
      isActive: { type: Boolean, default: true },
    }],
    currentSessionId: { type: String, default: '' },

    // Privacy & Security Logs
    auditLog: [{
      action: { type: String, required: true },
      ip: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      timestamp: { type: Date, default: Date.now },
      details: { type: String, default: '' },
    }],
  },
  { timestamps: true }
);

export const User = mongoose.model('User', UserSchema);
