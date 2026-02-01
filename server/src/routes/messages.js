import express from 'express';

import { requireAuth } from '../middleware/requireAuth.js';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';

export const messagesRouter = express.Router();

messagesRouter.get('/public/:roomId', requireAuth, async (req, res) => {
  const roomId = String(req.params.roomId || '').trim();
  if (!roomId) return res.status(400).json({ error: 'Invalid room' });

  const messages = await Message.find({ kind: 'public', roomId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('from', '_id displayName avatarUrl');

  res.json({
    messages: messages
      .reverse()
      .map((m) => ({
        id: String(m._id),
        text: m.text,
        createdAt: m.createdAt,
        from: {
          id: String(m.from._id),
          displayName: m.from.displayName,
          avatarUrl: m.from.avatarUrl,
        },
      })),
  });
});

messagesRouter.get('/private/:friendId', requireAuth, async (req, res) => {
  const friendId = String(req.params.friendId || '').trim();
  if (!friendId) return res.status(400).json({ error: 'Invalid friend' });

  const me = await User.findById(req.user._id);
  const isFriend = (me?.friends || []).some((id) => String(id) === friendId);
  if (!isFriend) return res.status(403).json({ error: 'Not friends' });

  const myId = String(req.user._id);

  const messages = await Message.find({
    kind: 'private',
    participants: { $all: [myId, friendId] },
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('from', '_id displayName avatarUrl');

  res.json({
    messages: messages
      .reverse()
      .map((m) => ({
        id: String(m._id),
        text: m.text,
        createdAt: m.createdAt,
        from: {
          id: String(m.from._id),
          displayName: m.from.displayName,
          avatarUrl: m.from.avatarUrl,
        },
      })),
  });
});
