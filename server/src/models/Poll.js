import mongoose from 'mongoose';

const PollSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    
    // Poll Context
    context: {
      type: { type: String, enum: ['message', 'group', 'room', 'global'], required: true },
      id: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be messageId, groupId, roomId, or null for global
    },
    
    // Poll Options
    options: [{
      text: { type: String, required: true, maxlength: 100 },
      votes: { type: Number, default: 0 },
      voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      color: { type: String, default: '#007bff' },
      order: { type: Number, default: 0 },
    }],
    
    // Poll Settings
    multipleChoice: { type: Boolean, default: false },
    maxChoices: { type: Number, default: 1 },
    anonymous: { type: Boolean, default: false },
    publicResults: { type: Boolean, default: true },
    
    // Poll Timing
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date },
    duration: { type: Number, default: 0 }, // in hours, 0 = no end time
    
    // Poll Status
    isActive: { type: Boolean, default: true },
    isClosed: { type: Boolean, default: false },
    closedAt: { type: Date },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Poll Permissions
    allowAddOptions: { type: Boolean, default: false },
    requireLogin: { type: Boolean, default: true },
    minReputation: { type: Number, default: 0 },
    
    // Poll Results
    totalVotes: { type: Number, default: 0 },
    uniqueVoters: { type: Number, default: 0 },
    
    // Poll Analytics
    analytics: {
      votesPerHour: { type: Number, default: 0 },
      peakVotingTime: { type: Date },
      voterDemographics: {
        newUsers: { type: Number, default: 0 },
        activeUsers: { type: Number, default: 0 },
        moderators: { type: Number, default: 0 },
      },
    },
    
    // Poll Moderation
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String, default: '' },
    isHidden: { type: Boolean, default: false },
    
    // Poll Comments
    allowComments: { type: Boolean, default: true },
    comments: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      text: { type: String, required: true, maxlength: 500 },
      createdAt: { type: Date, default: Date.now },
      isDeleted: { type: Boolean, default: false },
    }],
    
    // Poll Sharing
    shareableLink: { type: String, default: '' },
    embedCode: { type: String, default: '' },
    
    // Poll Results Notification
    notifyOnClose: { type: Boolean, default: true },
    resultsMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

PollSchema.index({ creator: 1, createdAt: -1 });
PollSchema.index({ 'context.type': 1, 'context.id': 1 });
PollSchema.index({ isActive: 1 });
PollSchema.index({ endsAt: 1 });
PollSchema.index({ isClosed: 1 });

export const Poll = mongoose.model('Poll', PollSchema);
