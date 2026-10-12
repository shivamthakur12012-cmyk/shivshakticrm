import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import logger from '../utils/logger';
import { isTokenBlacklisted, isUserTokensRevoked } from '../services/tokenBlacklist.service';

interface DecodedToken {
  id: string;
  email: string;
  iat?: number;
  exp?: number;
}

interface CachedUser {
  id: string;
  email: string;
  status: string;
  expiresAt: number;
}
const userCache = new Map<string, CachedUser>();

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    let token = '';

    // Check auth header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } 
    // Check cookies
    else if (req.cookies && req.cookies.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. No token provided.',
        errorCode: 'UNAUTHORIZED'
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error('JWT_SECRET is missing in environments');
      return res.status(500).json({
        success: false,
        message: 'Internal server configuration error.',
        errorCode: 'INTERNAL_ERROR'
      });
    }

    let decoded: DecodedToken;
    try {
      decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] }) as DecodedToken;
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Invalid or expired token.',
        errorCode: 'INVALID_TOKEN'
      });
    }

    // Check Redis Token Blacklist
    if (await isTokenBlacklisted(token)) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please log in again.',
        errorCode: 'TOKEN_REVOKED'
      });
    }

    // Check User-level Session Revocation
    if (decoded.iat && await isUserTokensRevoked(decoded.id, decoded.iat)) {
      return res.status(401).json({
        success: false,
        message: 'User session has been revoked. Please log in again.',
        errorCode: 'TOKEN_REVOKED'
      });
    }

    // Check memory cache first (30s TTL)
    const now = Date.now();
    let cached = userCache.get(decoded.id);

    if (!cached || now > cached.expiresAt) {
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed. User not found.',
          errorCode: 'USER_NOT_FOUND'
        });
      }
      cached = {
        id: String(user._id || user.id),
        email: user.email,
        status: user.status || 'active',
        expiresAt: now + 30 * 1000 // 30 seconds cache
      };
      userCache.set(decoded.id, cached);
    }

    if (cached.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated.',
        errorCode: 'ACCOUNT_DEACTIVATED'
      });
    }

    // Attach user to request
    req.user = {
      id: cached.id,
      email: cached.email
    };

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal authentication failure.',
      errorCode: 'INTERNAL_ERROR'
    });
  }
}
