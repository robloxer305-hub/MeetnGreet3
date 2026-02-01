import mongoose from 'mongoose';

const AnalyticsSchema = new mongoose.Schema(
  {
    // Analytics Context
    context: {
      type: { type: String, enum: ['user', 'group', 'room', 'message', 'global'], required: true },
      id: { type: mongoose.Schema.Types.Mixed, required: true },
    },
    
    // Analytics Period
    period: {
      type: { type: String, enum: ['hourly', 'daily', 'weekly', 'monthly', 'yearly'], required: true },
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },
    
    // User Analytics
    userAnalytics: {
      activeUsers: { type: Number, default: 0 },
      newUsers: { type: Number, default: 0 },
      returningUsers: { type: Number, default: 0 },
      totalUsers: { type: Number, default: 0 },
      onlineUsers: { type: Number, default: 0 },
      averageSessionDuration: { type: Number, default: 0 }, // in minutes
      userRetentionRate: { type: Number, default: 0 }, // percentage
      userChurnRate: { type: Number, default: 0 }, // percentage
    },
    
    // Message Analytics
    messageAnalytics: {
      totalMessages: { type: Number, default: 0 },
      messagesPerUser: { type: Number, default: 0 },
      averageMessageLength: { type: Number, default: 0 },
      messagesWithAttachments: { type: Number, default: 0 },
      messagesWithReactions: { type: Number, default: 0 },
      editedMessages: { type: Number, default: 0 },
      deletedMessages: { type: Number, default: 0 },
      topEmojis: [{ emoji: String, count: Number }],
      topWords: [{ word: String, count: Number }],
    },
    
    // Engagement Analytics
    engagementAnalytics: {
      reactionsPerMessage: { type: Number, default: 0 },
      repliesPerMessage: { type: Number, default: 0 },
      sharesPerMessage: { type: Number, default: 0 },
      pollParticipationRate: { type: Number, default: 0 },
      averageTimeOnPage: { type: Number, default: 0 }, // in minutes
      bounceRate: { type: Number, default: 0 }, // percentage
    },
    
    // Content Analytics
    contentAnalytics: {
      imagesShared: { type: Number, default: 0 },
      videosShared: { type: Number, default: 0 },
      filesShared: { type: Number, default: 0 },
      pollsCreated: { type: Number, default: 0 },
      groupsCreated: { type: Number, default: 0 },
      roomsCreated: { type: Number, default: 0 },
    },
    
    // Moderation Analytics
    moderationAnalytics: {
      reportsFiled: { type: Number, default: 0 },
      reportsResolved: { type: Number, default: 0 },
      usersBanned: { type: Number, default: 0 },
      messagesFlagged: { type: Number, default: 0 },
      contentRemoved: { type: Number, default: 0 },
      averageResponseTime: { type: Number, default: 0 }, // in hours
    },
    
    // Performance Analytics
    performanceAnalytics: {
      averageResponseTime: { type: Number, default: 0 }, // in milliseconds
      serverUptime: { type: Number, default: 0 }, // percentage
      errorRate: { type: Number, default: 0 }, // percentage
      databaseQueryTime: { type: Number, default: 0 }, // in milliseconds
      cacheHitRate: { type: Number, default: 0 }, // percentage
    },
    
    // Geographic Analytics
    geographicAnalytics: {
      countries: [{ country: String, users: Number }],
      cities: [{ city: String, users: Number }],
      timezones: [{ timezone: String, users: Number }],
    },
    
    // Device Analytics
    deviceAnalytics: {
      desktop: { type: Number, default: 0 },
      mobile: { type: Number, default: 0 },
      tablet: { type: Number, default: 0 },
      browsers: [{ browser: String, users: Number }],
      operatingSystems: [{ os: String, users: Number }],
    },
    
    // Feature Usage Analytics
    featureUsage: {
      reactions: { type: Number, default: 0 },
      polls: { type: Number, default: 0 },
      groups: { type: Number, default: 0 },
      voiceChat: { type: Number, default: 0 },
      videoChat: { type: Number, default: 0 },
      fileSharing: { type: Number, default: 0 },
      achievements: { type: Number, default: 0 },
    },
    
    // Growth Analytics
    growthAnalytics: {
      userGrowthRate: { type: Number, default: 0 }, // percentage
      messageGrowthRate: { type: Number, default: 0 }, // percentage
      engagementGrowthRate: { type: Number, default: 0 }, // percentage
      viralCoefficient: { type: Number, default: 0 },
    },
    
    // Custom Metrics
    customMetrics: [{
      name: { type: String, required: true },
      value: { type: mongoose.Schema.Types.Mixed, required: true },
      unit: { type: String, default: '' },
      description: { type: String, default: '' },
    }],
    
    // Analytics Metadata
    generatedAt: { type: Date, default: Date.now },
    version: { type: String, default: '1.0' },
    dataSource: { type: String, enum: ['database', 'cache', 'logs', 'external'], default: 'database' },
  },
  { timestamps: true }
);

AnalyticsSchema.index({ 'context.type': 1, 'context.id': 1 });
AnalyticsSchema.index({ 'period.start': 1, 'period.end': 1 });
AnalyticsSchema.index({ generatedAt: -1 });

export const Analytics = mongoose.model('Analytics', AnalyticsSchema);
