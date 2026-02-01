import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDb } from './lib/db.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { friendsRouter } from './routes/friends.js';
import { messagesRouter } from './routes/messages.js';
import { usersRouter } from './routes/users.js';
import { settingsRouter } from './routes/settings.js';
import { reactionsRouter } from './routes/reactions.js';
import { messageEditRouter } from './routes/messageEdit.js';
import { threadingRouter } from './routes/threading.js';
import { notificationsRouter } from './routes/notifications.js';
import { themeRouter } from './routes/theme.js';
import { groupsRouter } from './routes/groups.js';
import { moderationRouter } from './routes/moderation.js';
import { twoFactorRouter } from './routes/twoFactor.js';
import { roomsRouter } from './routes/rooms.js';
import { karmaRouter } from './routes/karma.js';
import { achievementsRouter } from './routes/achievements.js';
import { profilesRouter } from './routes/profiles.js';
import { followRouter } from './routes/follow.js';
import { pollsRouter } from './routes/polls.js';
import { privacyRouter } from './routes/privacy.js';
import { rolesRouter } from './routes/roles.js';
import { expirationRouter } from './routes/expiration.js';
import { encryptionRouter } from './routes/encryption.js';
import { bulkMessageRouter } from './routes/bulkMessage.js';
import { attachSocketServer } from './socket/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: CLIENT_ORIGIN,
  credentials: false,
}));

app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

app.use('/uploads', express.static(path.resolve('uploads')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reactions', reactionsRouter);
app.use('/api/messages', messageEditRouter);
app.use('/api/threads', threadingRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/theme', themeRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/moderation', moderationRouter);
app.use('/api/2fa', twoFactorRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/karma', karmaRouter);
app.use('/api/achievements', achievementsRouter);
app.use('/api/profiles', profilesRouter);
app.use('/api/follow', followRouter);
app.use('/api/polls', pollsRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/expiration', expirationRouter);
app.use('/api/encryption', encryptionRouter);
app.use('/api/bulk', bulkMessageRouter);

const clientDistPath = path.resolve('../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(clientIndexPath);
  });
}

await connectDb();
attachSocketServer(server, { clientOrigin: CLIENT_ORIGIN });

server.listen(PORT, () => {
  // no logs
});
