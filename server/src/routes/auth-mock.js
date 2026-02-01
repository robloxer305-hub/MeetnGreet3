import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const authRouter = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(72),
  displayName: z.string().min(1).max(40),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Mock user storage for testing
const mockUsers = new Map();

// Create a test user if none exist
if (mockUsers.size === 0) {
  mockUsers.set('test@example.com', {
    _id: '123456789012345678901234',
    email: 'test@example.com',
    passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // 'password'
    displayName: 'Test User',
    createdAt: new Date(),
  });
}

function signToken(userId) {
  return 'mock-jwt-token-' + userId;
}

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password, displayName } = parsed.data;

  if (mockUsers.has(email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = {
    _id: Date.now().toString(),
    email: email.toLowerCase(),
    passwordHash,
    displayName,
    createdAt: new Date(),
  };

  mockUsers.set(email.toLowerCase(), user);

  const token = signToken(user._id);
  res.cookie('token', token, {
    httpOnly: true,
    secure: false, // For testing
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  res.json({
    user: {
      _id: user._id,
      email: user.email,
      displayName: user.displayName,
    },
    token,
  });
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  const { email, password } = parsed.data;

  const user = mockUsers.get(email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user._id);
  res.cookie('token', token, {
    httpOnly: true,
    secure: false, // For testing
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  res.json({
    user: {
      _id: user._id,
      email: user.email,
      displayName: user.displayName,
    },
    token,
  });
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out' });
});

authRouter.get('/me', (req, res) => {
  const token = req.cookies.token;
  if (!token || !token.startsWith('mock-jwt-token-')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const userId = token.replace('mock-jwt-token-', '');
  const user = Array.from(mockUsers.values()).find(u => u._id === userId);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.json({
    user: {
      _id: user._id,
      email: user.email,
      displayName: user.displayName,
    },
  });
});
