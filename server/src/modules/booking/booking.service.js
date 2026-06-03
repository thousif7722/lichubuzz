'use strict';
const { Provider, Service, Coupon } = require('../../models');
const { cache } = require('../../config/redis');
const { AppError } = require('../../utils/errors');
const logger = require('../../utils/logger');
const { getIO } = require('../../socket');

// ── Haversine Distance Formula ─────────────────────────────────────────────────
function haversineDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth's radius in km

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// ── Smart Provider Matching ────────────────────────────────────────────────────
/**
 * Find and rank best providers for a booking.
 * Each provider has their own `serviceRadius` (km) — the maximum distance
 * they're willing to travel. We search within a 100 km ceiling geo query,
 * then filter down to only providers whose own radius covers the booking.
 *
 * Scoring weights: Distance 40% | Rating 30% | Tier 20% | Completion 10%
 */
async function findBestProviders(serviceId, coordinates, excludeProviders = [], limit = 10, attempt = 1) {
  // Base radius 20km, increases by 10km every attempt if no providers found
  const dynamicRadiusMeters = (20 + (attempt - 1) * 10) * 1000;

  const baseFilter = {
    services: serviceId,
    isBlocked: false,
    approvalStatus: 'approved',
    _id: { $nin: excludeProviders },
    'earnings.isOnHold': { $ne: true }, // Block providers with unpaid commission dues
  };

  // Try geo search first — wide net, individual radiuses applied later
  let providers = [];
  try {
    providers = await Provider.find({
      ...baseFilter,
      currentLocation: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: dynamicRadiusMeters,
        },
      },
    })
      .select('_id name phone rating ratingCount tier completedJobs cancelledJobs currentLocation isOnline serviceRadius')
      .limit(50)
      .lean();
  } catch (geoErr) {
    logger.warn('Geo search failed, falling back to non-geo search:', geoErr.message);
  }

  // Fall back: find ALL matching providers regardless of location
  if (providers.length === 0) {
    providers = await Provider.find(baseFilter)
      .select('_id name phone rating ratingCount tier completedJobs cancelledJobs currentLocation isOnline serviceRadius')
      .limit(50)
      .lean();
  }

  if (providers.length === 0) return [];

  const TIER_SCORE = { gold: 1.0, silver: 0.7, bronze: 0.4 };

  const scored = providers
    .map((provider) => {
      const coords = provider.currentLocation?.coordinates;
      if (!coords || coords.length < 2) return null;

      const distanceKm = haversineDistance(coordinates, coords);

      const dynamicSearchKm = 20 + (attempt - 1) * 10;
      if (distanceKm > dynamicSearchKm) return null; // Outside dynamic expansion radius

      // Respect each provider's own chosen service radius (optional fallback 30)
      const providerRadius = provider.serviceRadius || 30;
      if (distanceKm > providerRadius) return null; // outside this provider's zone

      const distanceScore = Math.max(0, 1 - distanceKm / dynamicSearchKm);
      const ratingScore = (provider.rating || 0) / 5;
      const tierScore = TIER_SCORE[provider.tier] || 0;
      const totalJobs = (provider.completedJobs || 0) + (provider.cancelledJobs || 0);
      const completionRate = totalJobs > 0 ? provider.completedJobs / totalJobs : 0.5;

      const score =
        distanceScore * 0.4 +
        ratingScore * 0.3 +
        tierScore * 0.2 +
        completionRate * 0.1;

      return { ...provider, score, distanceKm: Math.round(distanceKm * 10) / 10 };
    })
    .filter(Boolean); // drop out-of-radius providers

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── Auto-Assign Provider ───────────────────────────────────────────────────────
async function assignProviderToBooking(booking, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  const ACCEPT_TIMEOUT_SECONDS = 120; // 2 minutes to accept

  if (attempt > MAX_ATTEMPTS) {
    logger.warn(`Booking ${booking.bookingNumber}: Max assignment attempts reached`);
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledBy: 'system',
      reason: 'No providers available in your area',
      cancelledAt: new Date(),
      refundAmount: 0,
      cancellationCharge: 0,
    };
    await booking.save();

    const io = getIO();
    io.to(`user:${booking.customerId}`).emit('booking:failed', {
      bookingId: booking._id,
      message: 'Sorry, no providers are available in your area right now. Please try again later.',
    });
    return null;
  }

  const providers = await findBestProviders(
    booking.serviceId,
    booking.serviceAddress.location.coordinates,
    booking.rejectedProviders.map(String),
    10,
    attempt
  );

  if (providers.length === 0) {
    logger.info(`Booking ${booking.bookingNumber}: No providers found on attempt ${attempt}`);
    return null; // BullMQ will retry
  }

  const selectedProvider = providers[0];

  booking.providerId = selectedProvider._id;
  booking.status = 'assigned';
  booking.assignmentAttempts = attempt;
  booking.assignmentTimeout = new Date(Date.now() + ACCEPT_TIMEOUT_SECONDS * 1000);
  booking.timeline.push({
    status: 'assigned',
    note: `Auto-assigned to ${selectedProvider.name} (attempt ${attempt})`,
  });
  await booking.save();

  // Notify provider via Socket.io
  const io = getIO();
  const bookingRequest = {
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    service: booking.serviceId,
    scheduledDate: booking.scheduledDate,
    timeSlot: booking.timeSlot,
    address: {
      city: booking.serviceAddress.city,
      area: booking.serviceAddress.line1,
    },
    distanceKm: selectedProvider.distanceKm,
    estimatedEarnings: booking.providerEarnings,
    acceptTimeoutSeconds: ACCEPT_TIMEOUT_SECONDS,
  };

  io.to(`provider:${selectedProvider._id}`).emit('booking:new_request', bookingRequest);
  logger.info(`Booking ${booking.bookingNumber} assigned to provider ${selectedProvider.name}`);

  // Notify customer
  io.to(`user:${booking.customerId}`).emit('booking:assigned', {
    bookingId: booking._id,
    provider: {
      name: selectedProvider.name,
      rating: selectedProvider.rating,
      distanceKm: selectedProvider.distanceKm,
    },
    message: 'A provider has been found! Waiting for confirmation...',
  });

  // Store timeout job to handle non-response
  await cache.set(
    `booking_timeout:${booking._id}`,
    { bookingId: booking._id.toString(), providerId: selectedProvider._id.toString(), attempt },
    ACCEPT_TIMEOUT_SECONDS + 10
  );

  return selectedProvider;
}

// ── Surge Pricing ──────────────────────────────────────────────────────────────
async function calculateSurgePricing(serviceId, scheduledDate, coordinates) {
  try {
    const cacheKey = `surge:${serviceId}:${new Date(scheduledDate).getHours()}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const hour = new Date(scheduledDate).getHours();
    let multiplier = 1.0;

    // Time-based surge
    if (hour >= 7 && hour <= 9) multiplier *= 1.2;   // Morning rush
    if (hour >= 18 && hour <= 21) multiplier *= 1.3;  // Evening rush
    if (hour >= 22 || hour <= 6) multiplier *= 1.5;   // Night hours

    // Demand-based surge: check active bookings in area
    const { Booking } = require('../../models');
    const [lng, lat] = coordinates;
    const activeBookings = await Booking.countDocuments({
      status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] },
      scheduledDate: {
        $gte: new Date(scheduledDate).setHours(0, 0, 0, 0),
        $lte: new Date(scheduledDate).setHours(23, 59, 59, 999),
      },
      'serviceAddress.location': {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 5000, // 5km radius
        },
      },
    });

    if (activeBookings > 20) multiplier *= 1.2;
    if (activeBookings > 50) multiplier *= 1.4;

    // Clamp to max
    const MAX_SURGE = parseFloat(process.env.SURGE_MULTIPLIER_MAX || '2.5');
    multiplier = Math.min(multiplier, MAX_SURGE);
    multiplier = Math.round(multiplier * 10) / 10;

    await cache.set(cacheKey, multiplier, 300); // Cache 5 minutes
    return multiplier;
  } catch (err) {
    logger.error('Surge pricing calculation failed:', err);
    return 1.0; // Safe default
  }
}

// ── Coupon Application ─────────────────────────────────────────────────────────
async function applyCoupon(code, userId, orderAmount) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new AppError('Invalid coupon code', 400);

  const now = new Date();
  if (now < coupon.validFrom || now > coupon.validTo) {
    throw new AppError('Coupon has expired', 400);
  }
  if (orderAmount < coupon.minOrderValue) {
    throw new AppError(`Minimum order value of ₹${coupon.minOrderValue} required`, 400);
  }
  if (coupon.usedCount >= coupon.usageLimit) {
    throw new AppError('Coupon usage limit reached', 400);
  }

  const userUsage = coupon.usedBy.filter((u) => u.userId.toString() === userId.toString()).length;
  if (userUsage >= coupon.userLimit) {
    throw new AppError('You have already used this coupon', 400);
  }

  let discountAmount;
  if (coupon.discountType === 'flat') {
    discountAmount = coupon.discountValue;
  } else {
    discountAmount = (orderAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
  }
  discountAmount = Math.min(discountAmount, orderAmount); // Cannot exceed order amount

  return { discountAmount: Math.round(discountAmount), coupon };
}

async function recordCouponUsage(couponId, userId, session = null) {
  await Coupon.findByIdAndUpdate(
    couponId,
    {
      $inc: { usedCount: 1 },
      $push: { usedBy: { userId, usedAt: new Date() } },
    },
    { session }
  );
}

// ── Cancellation Charges ───────────────────────────────────────────────────────
function calculateCancellationCharge(booking) {
  const now = new Date();
  const scheduledTime = new Date(booking.scheduledDate);
  const hoursUntilService = (scheduledTime - now) / (1000 * 60 * 60);

  if (booking.status === 'pending') return 0;
  if (hoursUntilService > 24) return 0;           // Free cancellation 24h before
  if (hoursUntilService > 4) return booking.basePrice * 0.1; // 10% charge
  if (hoursUntilService > 1) return booking.basePrice * 0.25; // 25% charge
  return booking.basePrice * 0.5;                 // 50% charge within 1 hour
}

module.exports = {
  findBestProviders,
  assignProviderToBooking,
  calculateSurgePricing,
  applyCoupon,
  recordCouponUsage,
  calculateCancellationCharge,
  haversineDistance,
};
