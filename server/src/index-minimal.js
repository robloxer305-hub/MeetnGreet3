import path from 'path';
import fs from 'fs';
import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Only import essential routes
import { authRouter } from './routes/auth-mock.js';
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

// Only essential routes
app.use('/api/auth', authRouter);

const clientDistPath = path.resolve('../client/dist');
const clientIndexPath = path.join(clientDistPath, 'index.html');

if (fs.existsSync(clientIndexPath)) {
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(clientIndexPath);
  });
}

console.log('⚠️  Starting MINIMAL server for testing...');

attachSocketServer(server, { clientOrigin: true });

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 MINIMAL Server running on port ${PORT}`);
  console.log('⚠️  Only auth routes available - other features disabled');
});
