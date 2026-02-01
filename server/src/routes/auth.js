import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { User } from '../models/User.js';
import { signToken } from '../lib/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  displayName: z.string().min(1).max(40),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password, displayName } = parsed.data;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    displayName,
    avatarUrl: '',
  });

  const token = signToken(user);

  res.json({
    token,
    user: {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password } = parsed.data;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);

  res.json({
    token,
    user: {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
  });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      age: user.age,
      country: user.country,
      gender: user.gender,
      about: user.about,
      friends: (user.friends || []).map((id) => String(id)),
    },
  });
});

// Change password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(72),
});

authRouter.put('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { currentPassword, newPassword } = parsed.data;
  const user = req.user;

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await User.findByIdAndUpdate(user._id, { passwordHash: newPasswordHash });

  res.json({ message: 'Password changed successfully' });
});

// Delete account
authRouter.delete('/delete-account', requireAuth, async (req, res) => {
  const user = req.user;
  
  // Delete user's messages
  await require('../models/Message.js').Message.deleteMany({ 
    $or: [{ from: user._id }, { to: user._id }] 
  });
  
  // Delete friend requests
  await require('../models/FriendRequest.js').FriendRequest.deleteMany({ 
    $or: [{ from: user._id }, { to: user._id }] 
  });
  
  // Remove user from friends lists
  await User.updateMany(
    { friends: user._id },
    { $pull: { friends: user._id } }
  );
  
  // Delete the user
  await User.findByIdAndDelete(user._id);

  res.json({ message: 'Account deleted successfully' });
});

// Export user data
authRouter.get('/export-data', requireAuth, async (req, res) => {
  const user = req.user;
  
  const Message = require('../models/Message.js').Message;
  const FriendRequest = require('../models/FriendRequest.js').FriendRequest;
  
  // Get user's messages
  const messages = await Message.find({
    $or: [{ from: user._id }, { to: user._id }]
  }).populate('from to', 'displayName email');
  
  // Get user's friend requests
  const friendRequests = await FriendRequest.find({
    $or: [{ from: user._id }, { to: user._id }]
  }).populate('from to', 'displayName email');
  
  // Get user's friends
  const userWithFriends = await User.findById(user._id).populate('friends', 'displayName email');
  
  res.json({
    user: {
      id: String(user._id),
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      age: user.age,
      country: user.country,
      gender: user.gender,
      about: user.about,
      createdAt: user.createdAt,
      settings: {
        profileVisibility: user.profileVisibility,
        showAgeGender: user.showAgeGender,
        allowRandomChat: user.allowRandomChat,
        friendRequestPreference: user.friendRequestPreference,
        messageNotifications: user.messageNotifications,
        friendRequestNotifications: user.friendRequestNotifications,
        soundEffects: user.soundEffects,
        desktopNotifications: user.desktopNotifications,
        theme: user.theme,
        fontSize: user.fontSize,
        timestampFormat: user.timestampFormat,
        saveMessageHistory: user.saveMessageHistory,
        autoScroll: user.autoScroll,
        colorScheme: user.colorScheme,
        chatBubbleStyle: user.chatBubbleStyle,
        avatarSize: user.avatarSize,
      }
    },
    friends: userWithFriends.friends.map(friend => ({
      id: String(friend._id),
      displayName: friend.displayName,
      email: friend.email
    })),
    messages: messages.map(msg => ({
      id: String(msg._id),
      kind: msg.kind,
      roomId: msg.roomId,
      from: msg.from ? {
        id: String(msg.from._id),
        displayName: msg.from.displayName,
        email: msg.from.email
      } : null,
      to: msg.to ? {
        id: String(msg.to._id),
        displayName: msg.to.displayName,
        email: msg.to.email
      } : null,
      text: msg.text,
      createdAt: msg.createdAt
    })),
    friendRequests: friendRequests.map(req => ({
      id: String(req._id),
      from: {
        id: String(req.from._id),
        displayName: req.from.displayName,
        email: req.from.email
      },
      to: {
        id: String(req.to._id),
        displayName: req.to.displayName,
        email: req.to.email
      },
      status: req.status,
      createdAt: req.createdAt
    })),
    exportedAt: new Date().toISOString()
  });
});
