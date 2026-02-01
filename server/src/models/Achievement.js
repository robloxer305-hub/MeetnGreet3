import mongoose from 'mongoose';

const AchievementSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 500 },
    icon: { type: String, required: true },
    badgeColor: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'], default: 'bronze' },
    
    // Achievement Type
    type: { type: String, enum: ['message_count', 'friend_count', 'login_streak', 'group_created', 'moderation', 'special'], required: true },
    
    // Achievement Requirements
    requirements: {
      value: { type: Number, required: true },
      metric: { type: String, required: true }, // e.g., 'messages_sent', 'friends_added'
      timeframe: { type: String, enum: ['daily', 'weekly', 'monthly', 'all_time'], default: 'all_time' },
    },
    
    // Rewards
    rewards: {
      experience: { type: Number, default: 0 },
      karma: { type: Number, default: 0 },
      badge: { type: String, default: '' },
      title: { type: String, default: '' },
    },
    
    // Achievement Status
    isActive: { type: Boolean, default: true },
    isHidden: { type: Boolean, default: false }, // Hidden achievements (easter eggs)
    isRepeatable: { type: Boolean, default: false },
    
    // Achievement Progress (for users)
    userProgress: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      progress: { type: Number, default: 0 },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date },
      attempts: { type: Number, default: 0 },
    }],
    
    // Achievement Statistics
    totalEarned: { type: Number, default: 0 },
    earnedToday: { type: Number, default: 0 },
    earnedThisWeek: { type: Number, default: 0 },
    
    // Achievement Category
    category: { type: String, enum: ['social', 'messaging', 'moderation', 'creativity', 'technical', 'special'], default: 'social' },
    
    // Achievement Rarity
    rarity: { type: String, enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'], default: 'common' },
    
    // Achievement Prerequisites
    prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' }],
    
    // Achievement Expiration (for limited-time achievements)
    expiresAt: { type: Date },
    isExpired: { type: Boolean, default: false },
  },
  { timestamps: true }
);

AchievementSchema.index({ name: 1 });
AchievementSchema.index({ type: 1 });
AchievementSchema.index({ category: 1 });
AchievementSchema.index({ rarity: 1 });
AchievementSchema.index({ isActive: 1 });
AchievementSchema.index({ 'userProgress.user': 1 });
AchievementSchema.index({ expiresAt: 1 });

export const Achievement = mongoose.model('Achievement', AchievementSchema);
