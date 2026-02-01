import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Skip database connection for now
// import { connectDb } from './lib/db.js';

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
import { videoCallRouter } from './routes/video-call.js';
import { screenShareRouter } from './routes/screen-share.js';
import { voiceChannelRouter } from './routes/voice-channel.js';
import { liveStreamRouter } from './routes/live-stream.js';
import { whiteboardRouter } from './routes/whiteboard.js';
import { attachSocketServer } from './socket/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: 'Too many requests from this IP, please try again later.',
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/users', usersRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reactions', reactionsRouter);
app.use('/api/message-edit', messageEditRouter);
app.use('/api/threading', threadingRouter);
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
app.use('/api/video-call', videoCallRouter);
app.use('/api/screen-share', screenShareRouter);
app.use('/api/voice-channel', voiceChannelRouter);
app.use('/api/live-stream', liveStreamRouter);
app.use('/api/whiteboard', whiteboardRouter);

const clientDistPath = path.resolve('../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(clientIndexPath);
  });
}

// Skip database connection for now
// await connectDb();
console.log('⚠️  Starting server WITHOUT database connection for testing...');

attachSocketServer(server, { clientOrigin: true });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (WITHOUT DATABASE)`);
  console.log('⚠️  Login and database features will not work without database');
});
