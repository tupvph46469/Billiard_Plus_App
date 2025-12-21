// src/services/socketService.js
// Simple Socket.IO client wrapper. Requires `socket.io-client` package.
import { io } from 'socket.io-client';
import { CONFIG } from '../constants/config';

let socket = null;
let subscriptions = new Map(); // orderId -> callback

export function connectSocket(opts = {}) {
  if (socket && socket.connected) return socket;
  const url = opts.url || CONFIG.baseURL.replace(/^http/, 'ws');
  socket = io(opts.url || CONFIG.baseURL, {
    transports: ['websocket'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected', reason);
  });

  socket.on('order_paid', (data) => {
    // data expected to contain { orderId } or { billId }
    const id = data?.orderId || data?.billId || data?.order_id || data?.bill_id;
    if (!id) return;
    const cb = subscriptions.get(id);
    if (cb) cb(data);
  });

  // Generic broadcast handler
  socket.on('order_paid_global', (data) => {
    // call any callbacks subscribed
    subscriptions.forEach((cb, key) => cb(data));
  });

  return socket;
}

export function subscribeToOrder(orderId, cb) {
  if (!socket || !socket.connected) connectSocket();
  if (!socket) return;
  try {
    socket.emit('subscribe', { orderId });
  } catch (e) {
    // ignore
  }
  subscriptions.set(orderId, cb);
}

export function unsubscribeFromOrder(orderId) {
  subscriptions.delete(orderId);
  if (socket && socket.connected) {
    try {
      socket.emit('unsubscribe', { orderId });
    } catch (e) {
      // ignore
    }
  }
}

export function disconnectSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {}
    socket = null;
    subscriptions.clear();
  }
}

export default { connectSocket, subscribeToOrder, unsubscribeFromOrder, disconnectSocket };