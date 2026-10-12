import { Request, Response, NextFunction } from 'express';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const ipCache = new Map<string, RateLimitInfo>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 120; // 120 requests per minute

/**
 * Sliding window IP rate limiter middleware with zero external dependencies.
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  let limitInfo = ipCache.get(ip);

  if (!limitInfo) {
    limitInfo = {
      count: 1,
      resetTime: now + WINDOW_MS
    };
    ipCache.set(ip, limitInfo);
    
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - 1);
    return next();
  }

  // If window has passed, reset count and timeline
  if (now > limitInfo.resetTime) {
    limitInfo.count = 1;
    limitInfo.resetTime = now + WINDOW_MS;
    
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - 1);
    return next();
  }

  limitInfo.count += 1;

  if (limitInfo.count > MAX_REQUESTS) {
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', 0);
    res.setHeader('Retry-After', Math.ceil((limitInfo.resetTime - now) / 1000));
    
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please slow down and retry in a minute.',
      errorCode: 'RATE_LIMIT_EXCEEDED'
    });
  }

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - limitInfo.count);
  
  return next();
}

// Memory cleaner to prevent cache accumulation memory leaks over long cycles
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of ipCache.entries()) {
    if (now > info.resetTime) {
      ipCache.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Clean every 5 minutes
