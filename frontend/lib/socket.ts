import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const getSocket = (): Socket | null => socket;

export const initSocket = (token: string): Socket => {
  if (socket?.connected) return socket;

  socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
