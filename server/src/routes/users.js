import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { User } from '../models/User.js';

export const usersRouter = express.Router();

usersRouter.get('/:userId', requireAuth, async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  if (!userId) return res.status(400).json({ error: 'Invalid user ID' });

  const user = await User.findById(userId).select(
    'displayName avatarUrl age country gender about'
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({
    user: {
      id: userId,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      age: user.age,
      country: user.country,
      gender: user.gender,
      about: user.about,
    },
  });
});
