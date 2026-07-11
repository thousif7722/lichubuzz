'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Provider } = require('../../models');
const { cache } = require('../../config/redis');
const { AppError } = require('../../utils/errors');
const { validateBody } = require('../../middleware/validate');

const smsService = require('../../services/sms.service');
const logger = require('../../utils/logger');
const Joi = require('joi');

const router = express.Router();

// ── Validation Schemas ─────────────────────────────────────────────────────────
const sendOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required()
    .messages({ 'string.pattern.base': 'Enter a valid 10-digit Indian phone number' }),
  role: Joi.string().valid('customer', 'provider').default('customer'),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required(),
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  role: Joi.string().valid('customer', 'provider').default('customer'),
  name: Joi.string().min(2).max(100).optional(),
  referralCode: Joi.string().optional(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

// ── OTP Helpers ────────────────────────────────────────────────────────────────
function generateOTP() {
  return crypto.randomInt(100000, 999999).toString();
}

const OTP_TTL = parseInt(process.env.OTP_EXPIRY_MINUTES || '10') * 60; // seconds
const OTP_ATTEMPTS_LIMIT = 5;
const OTP_ATTEMPTS_WINDOW = 15 * 60; // 15 minutes

async function storeOTP(phone, otp) {
  const ok = await cache.set(`otp:${phone}`, { otp, phone }, OTP_TTL);
  if (!ok) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`[DEV] Redis unavailable - skipping OTP storage for ${phone}. Use 123456 to login.`);
    } else {
      throw new AppError('OTP service temporarily unavailable. Please try again shortly.', 503);
    }
  }
}

async function verifyOTP(phone, submittedOtp) {
  const attemptsKey = `otp_attempts:${phone}`;
  const attempts = await cache.increment(attemptsKey, OTP_ATTEMPTS_WINDOW);

  // FIX #4: Redis null means cache is unavailable — log warning but don't block production
  if (attempts === null) {
    logger.warn(`[WARN] Redis unavailable — OTP attempt limit bypassed for ${phone}`);
  } else if (process.env.NODE_ENV !== 'development' && attempts > OTP_ATTEMPTS_LIMIT) {
    throw new AppError('Too many OTP attempts. Please wait 15 minutes.', 429);
  }

  const stored = await cache.get(`otp:${phone}`);



  if (!stored) throw new AppError('OTP expired or not found. Please request a new one.', 400);
  if (stored.otp !== submittedOtp) throw new AppError('Invalid OTP. Please try again.', 400);

  // Clear OTP after successful verification
  await cache.del(`otp:${phone}`);
  await cache.del(attemptsKey);
  return true;
}

// ── JWT Helpers ────────────────────────────────────────────────────────────────
function generateTokens(userId, role) {
  const accessToken = jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refreshToken = jwt.sign(
    { userId, role, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
    { expiresIn: '30d' }
  );
  return { accessToken, refreshToken };
}

async function storeRefreshToken(userId, refreshToken) {
  await cache.set(`refresh:${userId}`, refreshToken, 30 * 24 * 60 * 60);
}

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * POST /auth/send-otp
 */
router.post('/send-otp', validateBody(sendOtpSchema), async (req, res) => {
  const { phone, role } = req.body;

  // Check if blocked
  const user = await User.findOne({ phone });
  if (user?.isBlocked) {
    throw new AppError('Your account has been blocked. Contact support.', 403);
  }

  const otp = generateOTP();
  await storeOTP(phone, otp);

  // Send SMS (non-blocking)
  smsService.sendOTP(phone, otp).catch((err) =>
    logger.error('Failed to send OTP SMS:', err)
  );

  logger.info(`OTP generated for ${phone} [${role}]`);
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[DEV ONLY] OTP for ${phone}: ${otp}`);
  }

  res.json({
    success: true,
    message: `OTP sent to +91${phone}`,
  });
});

/**
 * POST /auth/verify-otp
 */
router.post('/verify-otp', validateBody(verifyOtpSchema), async (req, res) => {
  const { phone, otp, role, name, referralCode } = req.body;

  await verifyOTP(phone, otp);

  let user;
  let isNewUser = false;

  if (role === 'provider') {
    // Provider flow: lookup Provider collection
    let provider = await Provider.findOne({ phone });
    if (!provider) {
      // Create stub provider profile
      const newUser = await User.findOneAndUpdate(
        { phone },
        { $setOnInsert: { phone, role: 'customer' } },
        { upsert: true, new: true }
      );
      provider = await Provider.create({
        userId: newUser._id,
        phone,
        name: name || `Provider_${phone.slice(-4)}`,
        currentLocation: { type: 'Point', coordinates: [0, 0] }
      });
      isNewUser = true;
    }
    if (provider.isBlocked) {
      throw new AppError('Your provider account is blocked. Contact support.', 403);
    }
    const tokens = generateTokens(provider._id, 'provider');
    await storeRefreshToken(provider._id, tokens.refreshToken);
    return res.json({
      success: true,
      isNewUser,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: provider._id,
        phone: provider.phone,
        name: provider.name,
        role: 'provider',
        approvalStatus: provider.approvalStatus,
        avatar: provider.avatar,
      },
    });
  }

  // Customer flow
  // FIX #2: Track whether customer was newly created (for referral rewards)
  const existingUser = await User.findOne({ phone });
  user = await User.findOneAndUpdate(
    { phone },
    {
      $setOnInsert: {
        phone,
        name: name || '',
        role: 'customer',
        referralCode: `REF${phone.slice(-4)}${Date.now().toString(36).toUpperCase()}`,
      },
    },
    { upsert: true, new: true }
  );
  isNewUser = !existingUser; // correctly detect new users

  if (!user.name && name) {
    user.name = name;
    await user.save();
  }

  // Handle referral — now correctly gated on isNewUser
  if (referralCode && isNewUser) {
    const referrer = await User.findOne({ referralCode });
    if (referrer && referrer._id.toString() !== user._id.toString()) {
      user.referredBy = referrer._id;
      await user.save();
      // Queue referral reward
      const { notificationQueue } = require('../../jobs');
      notificationQueue.add('referral_reward', {
        referrerId: referrer._id,
        newUserId: user._id,
      });
    }
  }

  const tokens = generateTokens(user._id, user.role);
  await storeRefreshToken(user._id, tokens.refreshToken);

  res.json({
    success: true,
    isNewUser,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: {
      id: user._id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      avatar: user.avatar,
      walletBalance: user.walletBalance,
      isPlusMember: user.subscription?.plan === 'premium',
    },
  });
});

/**
 * POST /auth/refresh
 * Rotate refresh tokens for security
 */
router.post('/refresh', validateBody(refreshSchema), async (req, res) => {
  const { refreshToken } = req.body;
  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh'
    );
    if (decoded.type !== 'refresh') throw new Error('Invalid token type');

    // Validate stored refresh token (prevent token reuse)
    const stored = await cache.get(`refresh:${decoded.userId}`);
    if (stored !== refreshToken) {
      throw new AppError('Refresh token is invalid or has been revoked', 401);
    }

    const tokens = generateTokens(decoded.userId, decoded.role);
    await storeRefreshToken(decoded.userId, tokens.refreshToken);

    res.json({ success: true, ...tokens });
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 401);
  }
});

/**
 * POST /auth/plus
 * Activate ServiceHub Plus Membership
 * - Development: no payment required (bypass for testing)
 * - Production: requires valid Razorpay payment verification
 */
router.post('/plus', authenticate, async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planMonths = 6 } = req.body;

  // Development bypass: allow activation without payment
  if (process.env.NODE_ENV === 'development') {
    logger.warn(`[DEV] Plus membership activated without payment for user ${req.userId}`);
  } else {
    // Production: verify Razorpay payment
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw new AppError('Payment details are required to activate Plus membership', 400);
    }

    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      logger.warn(`Plus activation: invalid signature for user ${req.userId}`);
      throw new AppError('Payment verification failed. Please contact support.', 400);
    }

    // Idempotency — prevent double activation with same payment
    const alreadyUsed = await cache.get(`plus_payment:${razorpayPaymentId}`);
    if (alreadyUsed) throw new AppError('This payment has already been used.', 400);
    await cache.set(`plus_payment:${razorpayPaymentId}`, '1', 30 * 24 * 60 * 60);
  }

  const user = await User.findById(req.userId);
  if (!user) throw new AppError('User not found', 404);

  const months = Math.min(Math.max(parseInt(planMonths) || 6, 1), 12);
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + months);

  user.subscription = {
    plan: 'premium',
    expiresAt,
    features: ['No Surge Pricing', 'Flat 10% Off', 'Priority Support'],
    activatedVia: razorpayPaymentId || 'dev_bypass',
  };
  await user.save();

  logger.info(`ServiceHub Plus activated for user ${req.userId} (${months} months)`);

  res.json({
    success: true,
    message: `Welcome to ServiceHub Plus! Active for ${months} months.`,
    user: {
      id: user._id,
      name: user.name,
      isPlusMember: true,
      subscriptionExpiry: expiresAt,
    }
  });
});

/**
 * POST /auth/logout
 */
router.post('/logout', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      // FIX #3: Use jwt.verify (not jwt.decode) to prevent forged token attacks
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.userId) {
        await cache.del(`refresh:${decoded.userId}`);
        // Blacklist current access token until expiry
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await cache.set(`blacklist:${token}`, '1', ttl);
        }
      }
    } catch (e) {
      // Expired tokens are fine to ignore on logout — token is already invalid
      logger.debug('Logout with invalid/expired token — ignoring:', e.message);
    }
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// ── Auth Middleware (exported for use in other routes) ─────────────────────────
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }
    const token = authHeader.split(' ')[1];

    // Check blacklist
    const isBlacklisted = await cache.get(`blacklist:${token}`);
    if (isBlacklisted) throw new AppError('Token has been revoked', 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token expired. Please refresh.', 401));
    }
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token', 401));
    }
    next(err);
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return next(new AppError('You are not authorized to perform this action', 403));
    }
    next();
  };
}

function requirePermission(permission) {
  return async (req, res, next) => {
    // Admin (Founder) has all permissions
    if (req.userRole === 'admin') return next();
    
    // Staff must have the specific permission
    if (req.userRole === 'staff') {
      const user = await User.findById(req.userId).select('permissions').lean();
      if (user && user.permissions && user.permissions.includes(permission)) {
        return next();
      }
    }
    
    return next(new AppError(`Permission denied: Requires ${permission}`, 403));
  };
}

module.exports = router;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;
module.exports.requirePermission = requirePermission;
