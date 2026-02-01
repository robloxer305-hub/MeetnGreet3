import express from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth.js';
import { User } from '../models/User.js';
import { FriendRequest } from '../models/FriendRequest.js';

export const friendsRouter = express.Router();

friendsRouter.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });

  const users = await User.find({
    $or: [
      { email: { $regex: q, $options: 'i' } },
      { displayName: { $regex: q, $options: 'i' } },
    ],
  })
    .limit(20)
    .select('_id email displayName avatarUrl country gender age');

  res.json({
    users: users
      .filter((u) => String(u._id) !== String(req.user._id))
      .map((u) => ({
        id: String(u._id),
        email: u.email,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        country: u.country,
        gender: u.gender,
        age: u.age,
      })),
  });
});

friendsRouter.get('/list', requireAuth, async (req, res) => {
  const me = await User.findById(req.user._id).populate('friends', '_id displayName avatarUrl');
  const friends = (me?.friends || []).map((f) => ({
    id: String(f._id),
    displayName: f.displayName,
    avatarUrl: f.avatarUrl,
  }));
  res.json({ friends });
});

const requestSchema = z.object({
  toUserId: z.string().min(1),
});

friendsRouter.post('/request', requireAuth, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const fromId = req.user._id;
  const toId = parsed.data.toUserId;

  if (String(fromId) === String(toId)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const toUser = await User.findById(toId);
  if (!toUser) return res.status(404).json({ error: 'User not found' });

  const me = await User.findById(fromId);
  const alreadyFriends = (me.friends || []).some((id) => String(id) === String(toId));
  if (alreadyFriends) return res.status(409).json({ error: 'Already friends' });

  try {
    const fr = await FriendRequest.create({ from: fromId, to: toId, status: 'pending' });
    res.json({ request: { id: String(fr._id), status: fr.status } });
  } catch {
    res.status(409).json({ error: 'Request already exists' });
  }
});

friendsRouter.get('/requests', requireAuth, async (req, res) => {
  const incoming = await FriendRequest.find({ to: req.user._id, status: 'pending' })
    .populate('from', '_id displayName avatarUrl')
    .sort({ createdAt: -1 });

  const outgoing = await FriendRequest.find({ from: req.user._id, status: 'pending' })
    .populate('to', '_id displayName avatarUrl')
    .sort({ createdAt: -1 });

  res.json({
    incoming: incoming.map((r) => ({
      id: String(r._id),
      from: {
        id: String(r.from._id),
        displayName: r.from.displayName,
        avatarUrl: r.from.avatarUrl,
      },
      createdAt: r.createdAt,
    })),
    outgoing: outgoing.map((r) => ({
      id: String(r._id),
      to: {
        id: String(r.to._id),
        displayName: r.to.displayName,
        avatarUrl: r.to.avatarUrl,
      },
      createdAt: r.createdAt,
    })),
  });
});

const actionSchema = z.object({
  requestId: z.string().min(1),
});

friendsRouter.post('/accept', requireAuth, async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const fr = await FriendRequest.findById(parsed.data.requestId);
  if (!fr || String(fr.to) !== String(req.user._id) || fr.status !== 'pending') {
    return res.status(404).json({ error: 'Request not found' });
  }

  fr.status = 'accepted';
  await fr.save();

  const [fromUser, toUser] = await Promise.all([User.findById(fr.from), User.findById(fr.to)]);

  if (fromUser && toUser) {
    if (!fromUser.friends.some((id) => String(id) === String(toUser._id))) fromUser.friends.push(toUser._id);
    if (!toUser.friends.some((id) => String(id) === String(fromUser._id))) toUser.friends.push(fromUser._id);
    await Promise.all([fromUser.save(), toUser.save()]);
  }

  res.json({ ok: true });
});

friendsRouter.post('/reject', requireAuth, async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const fr = await FriendRequest.findById(parsed.data.requestId);
  if (!fr || String(fr.to) !== String(req.user._id) || fr.status !== 'pending') {
    return res.status(404).json({ error: 'Request not found' });
  }

  fr.status = 'rejected';
  await fr.save();

  res.json({ ok: true });
});
