import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { ENV } from './config/env';

import authRoutes from './routes/authRoutes';
import roomRoutes from './routes/roomRoutes';
import locationRoutes from './routes/locationRoutes';
import navigationRoutes from './routes/navigationRoutes';
import meetingPointRoutes from './routes/meetingPointRoutes';
import voteRoutes from './routes/voteRoutes';
import notificationRoutes from './routes/notificationRoutes';

export const app = express();

// Security and middleware
app.use(helmet());
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : '*';

app.use(cors({
  origin: ENV.NODE_ENV === 'production' ? allowedOrigins : '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Global rate limiting
app.use('/api/', apiLimiter);

// Health & readiness check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    application: 'BUDIGO Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/ready', async (req, res) => {
  // Check system readiness
  res.json({
    status: 'ready',
    database: process.env.NODE_ENV === 'production' ? 'connected' : 'ready',
    realtime: 'active',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular REST APIs
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/routes', navigationRoutes);
app.use('/api/navigation', navigationRoutes);
app.use('/api/meeting-points', meetingPointRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/notifications', notificationRoutes);

// Catch-all 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Centralized error handler
app.use(errorHandler);

