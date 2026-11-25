import http from 'http';
import { Server } from 'socket.io';
import { app } from './app';
import { ENV } from './config/env';
import { setupSocketHandlers } from './sockets/socketHandler';

const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : '*';

const io = new Server(server, {
  cors: {
    origin: ENV.NODE_ENV === 'production' ? allowedOrigins : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Attach io instance to express app for controller access
app.set('io', io);

// Configure real-time socket events
setupSocketHandlers(io);

const PORT = parseInt(ENV.PORT, 10);

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 BUDIGO BACKEND SERVICE RUNNING ON PORT ${PORT}`);
    console.log(`📡 Real-Time Socket.IO Connected & Listening`);
    console.log(`🌍 Environment: ${ENV.NODE_ENV}`);
    console.log(`====================================================`);
  });
}

// Graceful Shutdown Handling (SIGTERM & SIGINT)
const gracefulShutdown = (signal: string) => {
  console.log(`\n[Budigo] Received ${signal}. Starting graceful shutdown...`);

  // Close HTTP server to stop accepting new requests
  server.close(() => {
    console.log('[Budigo] HTTP server closed.');

    // Close Socket.IO connections
    io.close(() => {
      console.log('[Budigo] Socket.IO server closed.');
      console.log('[Budigo] Graceful shutdown complete. Exiting cleanly.');
      process.exit(0);
    });
  });

  // Force close if clean termination exceeds 10 seconds
  setTimeout(() => {
    console.error('[Budigo] Forced shutdown: connections did not close in time.');
    process.exit(1);
  }, 10000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { server, io };
