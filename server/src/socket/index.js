import { Server } from 'socket.io';

import { verifyToken } from '../lib/auth.js';
import { User } from '../models/User.js';
import { Message } from '../models/Message.js';

function nowIso() {
  return new Date().toISOString();
}

function sanitizeText(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  return t.slice(0, 500);
}

export function attachSocketServer(httpServer, { clientOrigin }) {
  const io = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ['GET', 'POST'],
    },
  });

  const onlineUsers = new Map();
  const userSockets = new Map(); // Track multiple sockets per user

  const randomQueue = [];
  const randomPartnerBySocketId = new Map();

  function dequeue(socketId) {
    const idx = randomQueue.indexOf(socketId);
    if (idx >= 0) randomQueue.splice(idx, 1);
  }

  function endRandomPair(socketId) {
    const partnerId = randomPartnerBySocketId.get(socketId);
    randomPartnerBySocketId.delete(socketId);

    if (partnerId) {
      randomPartnerBySocketId.delete(partnerId);
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket) {
        partnerSocket.emit('random:ended', { at: nowIso() });
      }
    }
  }

  function tryMatch() {
    while (randomQueue.length >= 2) {
      const a = randomQueue.shift();
      const b = randomQueue.shift();
      const sa = io.sockets.sockets.get(a);
      const sb = io.sockets.sockets.get(b);
      if (!sa || !sb) continue;

      randomPartnerBySocketId.set(a, b);
      randomPartnerBySocketId.set(b, a);

      sa.emit('random:matched', {
        at: nowIso(),
        partner: {
          id: String(sb.data.user._id),
          displayName: sb.data.user.displayName,
          avatarUrl: sb.data.user.avatarUrl,
        },
      });

      sb.emit('random:matched', {
        at: nowIso(),
        partner: {
          id: String(sa.data.user._id),
          displayName: sa.data.user.displayName,
          avatarUrl: sa.data.user.avatarUrl,
        },
      });
    }
  }

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));

      const payload = verifyToken(token);
      const userId = payload?.sub;
      if (!userId) return next(new Error('unauthorized'));

      const user = await User.findById(userId);
      if (!user) return next(new Error('unauthorized'));

      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const userId = user._id.toString();

    console.log('🔌 User connected:', userId, 'Socket:', socket.id);

    // Track user socket
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId).add(socket.id);


    // Update user online status
    onlineUsers.set(userId, {
      socketId: socket.id,
      user,
      status: 'online',
      lastSeen: new Date(),
      currentRoom: '',
    });

    // Update user in database
    updateUserOnlineStatus(userId, 'online');

    // Broadcast user online status to friends
    broadcastUserStatus(userId, 'online');
    
    console.log('🔍 Current online users:', Array.from(onlineUsers.keys()));

    const lastMessageAt = { t: 0 };
    function allowSend() {
      const now = Date.now();
      if (now - lastMessageAt.t < 650) return false;
      lastMessageAt.t = now;
      return true;
    }

    socket.on('public:join', async ({ roomId }) => {
      const r = String(roomId || '').trim();
      if (!r) return;
      await socket.join(`public:${r}`);
    });

    socket.on('public:message', async ({ roomId, text }) => {
      if (!allowSend()) return;

      const r = String(roomId || '').trim();
      const t = sanitizeText(text);
      if (!r || !t) return;

      const msg = await Message.create({
        kind: 'public',
        roomId: r,
        from: user._id,
        text: t,
      });

      io.to(`public:${r}`).emit('public:message', {
        id: String(msg._id),
        roomId: r,
        text: msg.text,
        createdAt: msg.createdAt,
        from: {
          id: String(user._id),
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      });
    });

    socket.on('private:message', async ({ toUserId, text }) => {
      if (!allowSend()) return;

      const toId = String(toUserId || '').trim();
      const t = sanitizeText(text);
      if (!toId || !t) return;

      const me = await User.findById(user._id);
      const isFriend = (me?.friends || []).some((id) => String(id) === toId);
      if (!isFriend) return;

      const toUser = await User.findById(toId);
      if (!toUser) return;

      const msg = await Message.create({
        kind: 'private',
        participants: [user._id, toUser._id],
        from: user._id,
        to: toUser._id,
        text: t,
      });

      const payload = {
        id: String(msg._id),
        text: msg.text,
        createdAt: msg.createdAt,
        from: {
          id: String(user._id),
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
        toUserId: String(toUser._id),
      };

      socket.emit('private:message', payload);

      const toSocketId = onlineUsers.get(String(toUser._id));
      if (toSocketId) {
        io.to(toSocketId).emit('private:message', payload);
      }
    });

    socket.on('random:start', () => {
      endRandomPair(socket.id);
      dequeue(socket.id);
      randomQueue.push(socket.id);
      socket.emit('random:queued', { at: nowIso() });
      tryMatch();
    });

    socket.on('random:next', () => {
      endRandomPair(socket.id);
      dequeue(socket.id);
      randomQueue.push(socket.id);
      socket.emit('random:queued', { at: nowIso() });
      tryMatch();
    });

    socket.on('random:message', ({ text }) => {
      if (!allowSend()) return;

      const t = sanitizeText(text);
      if (!t) return;

      const partnerId = randomPartnerBySocketId.get(socket.id);
      if (!partnerId) return;

      const payload = {
        text: t,
        createdAt: new Date(),
        from: {
          id: String(user._id),
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      };

      socket.emit('random:message', payload);
      io.to(partnerId).emit('random:message', payload);
    });

    // Typing indicators
    socket.on('typing:start', ({ roomId, groupId, toUserId }) => {
      const roomKey = roomId || groupId?.toString() || `private:${toUserId}`;
      
      if (!typingUsers.has(roomKey)) {
        typingUsers.set(roomKey, new Set());
      }
      
      typingUsers.get(roomKey).add(userId);
      
      // Broadcast typing indicator to room (excluding sender)
      socket.to(roomKey).emit('typing:indicator', {
        userId,
        displayName: user.displayName,
        isTyping: true,
        roomKey,
      });
    });

    socket.on('typing:stop', ({ roomId, groupId, toUserId }) => {
      const roomKey = roomId || groupId?.toString() || `private:${toUserId}`;
      
      if (typingUsers.has(roomKey)) {
        typingUsers.get(roomKey).delete(userId);
        
        // Broadcast stop typing indicator
        socket.to(roomKey).emit('typing:indicator', {
          userId,
          displayName: user.displayName,
          isTyping: false,
          roomKey,
        });
      }
    });

    // Read receipts
    socket.on('message:read', async ({ messageId, roomId, groupId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        // Check if user is a participant
        if (!message.participants.includes(user._id)) return;

        // Add user to readBy array if not already there
        const alreadyRead = message.readBy.some(read => read.user.toString() === userId);
        if (!alreadyRead) {
          message.readBy.push({
            user: user._id,
            readAt: new Date(),
          });
          await message.save();

          // Broadcast read receipt to message sender
          const roomKey = roomId || groupId?.toString();
          if (roomKey) {
            socket.to(roomKey).emit('message:read_receipt', {
              messageId,
              userId,
              readAt: new Date(),
            });
          } else {
            // For private messages, notify sender directly
            const senderSocketId = onlineUsers.get(message.from.toString());
            if (senderSocketId) {
              io.to(senderSocketId).emit('message:read_receipt', {
                messageId,
                userId,
                readAt: new Date(),
              });
            }
          }
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    });

    // Online status updates
    socket.on('status:update', async ({ status }) => {
      try {
        const validStatuses = ['online', 'away', 'offline', 'invisible'];
        if (!validStatuses.includes(status)) return;

        // Update in online users map
        const onlineUser = onlineUsers.get(userId);
        if (onlineUser) {
          onlineUser.status = status;
          onlineUser.lastSeen = new Date();
        }

        // Update in database
        await updateUserOnlineStatus(userId, status);

        // Broadcast to friends (unless invisible)
        if (status !== 'invisible') {
          broadcastUserStatus(userId, status);
        }
      } catch (error) {
        console.error('Error updating user status:', error);
      }
    });

    // Room joining/leaving
    socket.on('room:join', ({ roomId }) => {
      socket.join(roomId);
      
      // Update user's current room
      const onlineUser = onlineUsers.get(userId);
      if (onlineUser) {
        onlineUser.currentRoom = roomId;
      }

      // Update user in database
      updateUserCurrentRoom(userId, roomId);

      // Broadcast room join to other users
      socket.to(roomId).emit('user:joined', {
        userId,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        roomId,
      });
    });

    socket.on('room:leave', ({ roomId }) => {
      socket.leave(roomId);
      
      // Update user's current room
      const onlineUser = onlineUsers.get(userId);
      if (onlineUser) {
        onlineUser.currentRoom = '';
      }

      // Update user in database
      updateUserCurrentRoom(userId, '');

      // Broadcast room leave to other users
      socket.to(roomId).emit('user:left', {
        userId,
        displayName: user.displayName,
        roomId,
      });
    });

    socket.on('disconnect', () => {
      // Remove socket from user sockets
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        
        // If user has no more sockets, mark as offline
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
          onlineUsers.delete(userId);
          
          // Update user status in database
          updateUserOnlineStatus(userId, 'offline');
          
          // Broadcast offline status to friends
          broadcastUserStatus(userId, 'offline');
        }
      }
      
      endRandomPair(socket.id);
      dequeue(socket.id);
    });

    
    // Test socket connection
    socket.on('ping', (data) => {
      console.log('🔍 Ping received:', data);
      socket.emit('pong', { received: data, timestamp: new Date() });
    });

    // Debug: Log all events
    socket.onAny((eventName, ...args) => {
      console.log('🔍 Socket event received:', eventName, args);
    });





  });

  // Helper functions
  async function updateUserOnlineStatus(userId, status) {
    try {
      await User.findByIdAndUpdate(userId, {
        onlineStatus: status,
        lastSeen: new Date(),
      });
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  async function updateUserCurrentRoom(userId, roomId) {
    try {
      await User.findByIdAndUpdate(userId, {
        currentRoom: roomId,
      });
    } catch (error) {
      console.error('Error updating user current room:', error);
    }
  }

  function broadcastUserStatus(userId, status) {
    try {
      // Get user's friends and broadcast to them
      User.findById(userId).then(user => {
        if (user && user.friends) {
          user.friends.forEach(friendId => {
            const friendSocketIds = userSockets.get(friendId.toString());
            if (friendSocketIds) {
              friendSocketIds.forEach(socketId => {
                io.to(socketId).emit('friend:status_update', {
                  userId,
                  status,
                  lastSeen: new Date(),
                });
              });
            }
          });
        }
      });
    } catch (error) {
      console.error('Error broadcasting user status:', error);
    }
  }


  return io;
}
