import rateLimit from 'express-rate-limit';

// Standard API rate limiter (15 minutes, 300 requests)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: {
    success: false,
    error: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for route & matrix calculations to prevent API quota drain
export const routeCalculationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    error: 'Route calculation rate limit exceeded. Please wait a moment before recalculating.',
  },
});

// Location update limiter (relaxed for frequent GPS reports)
export const locationLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 20, // max 2 updates per second per device
  message: {
    success: false,
    error: 'Location update rate limit exceeded.',
  },
});

