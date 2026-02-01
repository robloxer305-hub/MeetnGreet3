import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['public', 'private', 'group', 'announcement'], required: true, index: true },

    roomId: { type: String, default: '' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },

    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    text: { type: String, required: true },
    
    // Message Content Types
    contentType: { type: String, enum: ['text', 'image', 'video', 'audio', 'file', 'poll', 'location'], default: 'text' },
    attachments: [{
      type: { type: String, enum: ['image', 'video', 'audio', 'file'], required: true },
      url: { type: String, required: true },
      filename: { type: String, default: '' },
      size: { type: Number, default: 0 },
      mimeType: { type: String, default: '' },
    }],
    
    // Message Threading
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
    
    // Message Editing & Deletion
    isEdited: { type: Boolean, default: false },
    editHistory: [{
      text: { type: String, required: true },
      editedAt: { type: Date, default: Date.now },
    }],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Message Reactions
    reactions: [{
      emoji: { type: String, required: true },
      users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      count: { type: Number, default: 0 },
    }],
    
    // Message Status
    readBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      readAt: { type: Date, default: Date.now },
    }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    
    // Message Expiration
    expiresAt: { type: Date },
    isExpired: { type: Boolean, default: false },
    
    // Encryption
    isEncrypted: { type: Boolean, default: false },
    encryptionKey: { type: String, default: '' },
    
    // Moderation
    isFlagged: { type: Boolean, default: false },
    flagReason: { type: String, default: '' },
    isHidden: { type: Boolean, default: false },
    
    // Polls (for poll messages)
    pollData: {
      question: { type: String },
      options: [{
        text: { type: String, required: true },
        votes: { type: Number, default: 0 },
        voters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      }],
      multipleChoice: { type: Boolean, default: false },
      endsAt: { type: Date },
      isActive: { type: Boolean, default: true },
    },
    
    // Location (for location messages)
    locationData: {
      latitude: { type: Number },
      longitude: { type: Number },
      address: { type: String, default: '' },
      placeName: { type: String, default: '' },
    },
    
    // Priority & Importance
    priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
    isPinned: { type: Boolean, default: false },
    
    // System Messages
    isSystemMessage: { type: Boolean, default: false },
    systemMessageType: { type: String, enum: ['user_joined', 'user_left', 'user_added', 'user_removed', 'room_created', 'room_deleted'] },
    systemMessageData: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

MessageSchema.index({ kind: 1, roomId: 1, createdAt: -1 });
MessageSchema.index({ kind: 1, participants: 1, createdAt: -1 });
MessageSchema.index({ groupId: 1, createdAt: -1 });
MessageSchema.index({ replyTo: 1 });
MessageSchema.index({ threadId: 1 });
MessageSchema.index({ from: 1, createdAt: -1 });
MessageSchema.index({ to: 1, createdAt: -1 });
MessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
MessageSchema.index({ isDeleted: 1, createdAt: -1 });

export const Message = mongoose.model('Message', MessageSchema);
