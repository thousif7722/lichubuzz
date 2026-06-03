'use strict';
// ═══════════════════════════ rateLimiter.js ════════════════════════════════════
const rateLimit = require('express-rate-limit');

const rateLimitHandler = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests. Please slow down.',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    retryAfter: 60,
  });
};

// ── General API: 100 requests per 1 minute (user can tap 100 times/min) ────────
const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  skip: () => process.env.NODE_ENV === 'development',
});

// ── Auth endpoints: 10 attempts per 15 minutes ─────────────────────────────────
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.body?.phone || req.ip,
  skip: () => process.env.NODE_ENV === 'development',
});

// ── OTP send: max 3 per phone per 15 minutes ──────────────────────────────────
const otpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  handler: rateLimitHandler,
  keyGenerator: (req) => `otp_req:${req.body?.phone || req.ip}`,
  skip: () => process.env.NODE_ENV === 'development',
});

// ── Payment endpoints: 5 per minute ───────────────────────────────────────────
const paymentRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  handler: rateLimitHandler,
  skip: () => process.env.NODE_ENV === 'development',
});

// ── Booking creation: 10 per minute per user ──────────────────────────────────
const bookingRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  handler: rateLimitHandler,
  keyGenerator: (req) => req.headers.authorization?.split(' ')[1]?.slice(-12) || req.ip,
  skip: () => process.env.NODE_ENV === 'development',
});

module.exports = { apiRateLimiter, authRateLimiter, otpRateLimiter, paymentRateLimiter, bookingRateLimiter };
