import { io } from 'socket.io-client';
import { SOCKET_URL } from './config.js';

export function createSocket(token) {
  return io(SOCKET_URL || undefined, {
    autoConnect: true,
    transports: ['websocket'],
    auth: { token },
  });
}
