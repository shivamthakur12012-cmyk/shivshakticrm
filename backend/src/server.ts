import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before importing other local files
dotenv.config();

import { connectDB, disconnectDB } from './config/db';
import { initRedis, isRedisActive } from './config/redis';
import { rateLimiter } from './middleware/rateLimit.middleware';
import apiRouter from './routes';
import logger from './utils/logger';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable reverse proxy trust (vital for Docker, Nginx, Render, Cloudflare, etc.)
app.set('trust proxy', 1);

// Security & Parsing Middlewares
app.use(helmet());
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach(o => {
    const trimmed = o.trim().replace(/\/$/, '');
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, postman, direct server calls)
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      const match = allowedOrigins.some(o => o.replace(/\/$/, '') === normalized);
      if (match || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-organization-id']
  })
);
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Database & Cache Initialization
connectDB();
initRedis();

// Health Check Endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy.',
    redis: isRedisActive() ? 'connected' : 'memory_fallback',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Bind API Routes with rate limiter protection
app.use('/api', rateLimiter, apiRouter);

// Global Error Handler Middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled request error:', err);

  const status = err.status || 500;
  const response: any = {
    success: false,
    message: err.message || 'An unexpected error occurred.',
    errorCode: err.errorCode || 'INTERNAL_SERVER_ERROR'
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  res.status(status).json(response);
});

// Start Express Server
const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful Shutdown
const handleShutdown = async (signal: string) => {
  logger.warn(`${signal} received. Shutting down gracefully.`);
  await disconnectDB();
  server.close(() => {
    logger.info('Server and database connections terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
