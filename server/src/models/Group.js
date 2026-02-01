import mongoose from 'mongoose';

const GroupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    avatarUrl: { type: String, default: '' },
    
    // Group Settings
    isPrivate: { type: Boolean, default: false },
    inviteOnly: { type: Boolean, default: false },
    approvalRequired: { type: Boolean, default: false },
    
    // Group Members
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    members: [{ 
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      joinedAt: { type: Date, default: Date.now },
      role: { type: String, enum: ['member', 'admin', 'moderator'], default: 'member' },
      nickname: { type: String, default: '' },
      permissions: [String],
    }],
    
    // Group Categories & Topics
    category: { type: String, enum: ['general', 'gaming', 'tech', 'music', 'art', 'sports', 'education', 'business', 'entertainment', 'other'], default: 'general' },
    tags: [String],
    topic: { type: String, default: '' },
    
    // Group Statistics
    memberCount: { type: Number, default: 0 },
    messageCount: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
    
    // Group Features
    allowFileSharing: { type: Boolean, default: true },
    allowVoiceChannels: { type: Boolean, default: false },
    allowVideoCalls: { type: Boolean, default: false },
    allowPolls: { type: Boolean, default: true },
    allowReactions: { type: Boolean, default: true },
    
    // Moderation
    isArchived: { type: Boolean, default: false },
    isFrozen: { type: Boolean, default: false },
    autoModeration: { type: Boolean, default: true },
    bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Voice Channels (if enabled)
    voiceChannels: [{
      name: { type: String, required: true },
      description: { type: String, default: '' },
      maxUsers: { type: Number, default: 10 },
      currentUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      isLocked: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now },
    }],
    
    // Group Settings
    messageRetentionDays: { type: Number, default: 0 }, // 0 = forever
    maxFileSize: { type: Number, default: 10485760 }, // 10MB
    allowInvites: { type: Boolean, default: true },
    requireApprovalToJoin: { type: Boolean, default: false },
    
    // Group Invites
    invites: [{
      code: { type: String },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date },
      maxUses: { type: Number, default: 0 }, // 0 = unlimited
      uses: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
    }],
    
    // Group Roles
    customRoles: [{
      name: { type: String, required: true },
      color: { type: String, default: '#000000' },
      permissions: [String],
      position: { type: Number, default: 0 },
      isDefault: { type: Boolean, default: false },
    }],
  },
  { timestamps: true }
);

GroupSchema.index({ name: 1 });
GroupSchema.index({ creator: 1 });
GroupSchema.index({ 'members.user': 1 });
GroupSchema.index({ category: 1 });
GroupSchema.index({ isPrivate: 1 });
GroupSchema.index({ lastActivity: -1 });

export const Group = mongoose.model('Group', GroupSchema);
