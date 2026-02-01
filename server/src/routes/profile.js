import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { z } from 'zod';

import { requireAuth } from '../middleware/requireAuth.js';

export const profileRouter = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(path.resolve('uploads'), { recursive: true });
    cb(null, path.resolve('uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10);
    const safeExt = ext && ext.length <= 10 ? ext : '';
    cb(null, `${String(req.user._id)}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
});

profileRouter.get('/me', requireAuth, async (req, res) => {
  const u = req.user;
  res.json({
    profile: {
      id: String(u._id),
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      age: u.age,
      country: u.country,
      gender: u.gender,
      about: u.about,
    },
  });
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(40),
  age: z.number().int().min(13).max(120).nullable().optional(),
  country: z.string().max(80).optional(),
  gender: z.string().max(40).optional(),
  about: z.string().max(300).optional(),
});

profileRouter.put('/me', requireAuth, async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const u = req.user;
  const { displayName, age, country, gender, about } = parsed.data;

  u.displayName = displayName;
  if (age !== undefined) u.age = age;
  if (country !== undefined) u.country = country;
  if (gender !== undefined) u.gender = gender;
  if (about !== undefined) u.about = about;

  await u.save();

  res.json({
    profile: {
      id: String(u._id),
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      age: u.age,
      country: u.country,
      gender: u.gender,
      about: u.about,
    },
  });
});

profileRouter.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Missing file' });
  }

  const u = req.user;
  u.avatarUrl = `/uploads/${req.file.filename}`;
  await u.save();

  res.json({ avatarUrl: u.avatarUrl });
});
