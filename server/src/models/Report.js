import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    reportedGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
    reportedRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    
    // Report Details
    reason: { type: String, enum: ['spam', 'harassment', 'inappropriate_content', 'violence', 'copyright', 'impersonation', 'other'], required: true },
    description: { type: String, required: true, maxlength: 1000 },
    category: { type: String, enum: ['user', 'message', 'group', 'room'], required: true },
    
    // Report Status
    status: { type: String, enum: ['pending', 'under_review', 'resolved', 'dismissed', 'escalated'], default: 'pending' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    
    // Review Process
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, default: '' },
    actionTaken: { type: String, enum: ['none', 'warning', 'temporary_ban', 'permanent_ban', 'content_removal', 'other'], default: 'none' },
    actionDetails: { type: String, default: '' },
    
    // Report Evidence
    evidence: [{
      type: { type: String, enum: ['screenshot', 'log', 'message', 'file'], required: true },
      url: { type: String, required: true },
      description: { type: String, default: '' },
      uploadedAt: { type: Date, default: Date.now },
    }],
    
    // Report History
    history: [{
      action: { type: String, required: true },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      performedAt: { type: Date, default: Date.now },
      notes: { type: String, default: '' },
    }],
    
    // Report Statistics
    similarReports: { type: Number, default: 0 },
    previousReports: { type: Number, default: 0 },
    
    // Report Resolution
    resolvedAt: { type: Date },
    resolutionNotes: { type: String, default: '' },
    appealable: { type: Boolean, default: true },
    appealDeadline: { type: Date },
    
    // Automated Analysis
    aiAnalysis: {
      toxicityScore: { type: Number, default: 0 },
      spamScore: { type: Number, default: 0 },
      categories: [String],
      confidence: { type: Number, default: 0 },
    },
    
    // Report Communication
    reporterNotified: { type: Boolean, default: false },
    reportedUserNotified: { type: Boolean, default: false },
    publicStatement: { type: String, default: '' },
  },
  { timestamps: true }
);

ReportSchema.index({ reporter: 1, createdAt: -1 });
ReportSchema.index({ reportedUser: 1, createdAt: -1 });
ReportSchema.index({ status: 1 });
ReportSchema.index({ priority: 1 });
ReportSchema.index({ category: 1 });
ReportSchema.index({ reason: 1 });
ReportSchema.index({ reviewedBy: 1 });

export const Report = mongoose.model('Report', ReportSchema);
