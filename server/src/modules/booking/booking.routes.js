'use strict';
const express = require('express');
const Joi = require('joi');
const mongoose = require('mongoose');
const { Booking, Provider, Service, MaterialsUsed, User } = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { validateBody, validateQuery } = require('../../middleware/validate');
const { AppError } = require('../../utils/errors');
const { cache } = require('../../config/redis');
const bookingService = require('./booking.service');
const { getIO } = require('../../socket');
const logger = require('../../utils/logger');
const pdfService = require('../../services/pdf.service');
const { bookingRateLimiter } = require('../../middleware/rateLimiter');

const router = express.Router();

// ── Validation Schemas ─────────────────────────────────────────────────────────
const createBookingSchema = Joi.object({
  serviceId: Joi.string().hex().length(24).required(),
  scheduledDate: Joi.date().min(new Date(new Date().setHours(0, 0, 0, 0))).required(),
  timeSlot: Joi.object({
    from: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    to: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  }).required(),
  serviceAddress: Joi.object({
    line1: Joi.string().required(),
    line2: Joi.string().optional(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    pincode: Joi.string().pattern(/^\d{6}$/).required(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(), // [lng, lat]
    }).required(),
  }).required(),
  customerNotes: Joi.string().max(500).optional(),
  couponCode: Joi.string().optional(),
});

const addMaterialsSchema = Joi.object({
  items: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    quantity: Joi.number().positive().required(),
    unit: Joi.string().default('pcs'),
    unitPrice: Joi.number().positive().required(),
    brand: Joi.string().optional(),
    isProviderOwned: Joi.boolean().default(true),
  })).min(0).required(),
  notes: Joi.string().max(500).optional(),
});

const completeBookingSchema = Joi.object({
  workPerformed: Joi.string().required(),
  extraCharges: Joi.number().min(0).default(0),
  extraChargesNote: Joi.string().optional(),
  afterPhotos: Joi.array().items(Joi.string()).optional(),
  endOtp: Joi.string().length(4).pattern(/^\d{4}$/).optional(),
  lat: Joi.number().optional(),
  lng: Joi.number().optional(),
});

// ── Routes ─────────────────────────────────────────────────────────────────────

/**
 * GET /bookings
 * Get bookings for authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  // FIX #4: Sanitize page/limit to prevent NaN crashing DB queries
  const rawPage = parseInt(req.query.page);
  const rawLimit = parseInt(req.query.limit);
  const page = (!isNaN(rawPage) && rawPage > 0) ? rawPage : 1;
  const limit = (!isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 100) ? rawLimit : 10;
  const { status, from, to } = req.query;
  const skip = (page - 1) * limit;

  let filter = {};
  if (req.userRole === 'customer') filter.customerId = req.userId;
  else if (req.userRole === 'provider') filter.providerId = req.userId;

  if (status) {
    const statusList = status.split(',').map(s => s.trim()).filter(Boolean);
    filter.status = statusList.length === 1 ? statusList[0] : { $in: statusList };
  }
  if (from || to) {
    filter.scheduledDate = {};
    if (from) filter.scheduledDate.$gte = new Date(from);
    if (to) filter.scheduledDate.$lte = new Date(to);
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('serviceId', 'name icon category')
      .populate('customerId', 'name phone avatar')
      .populate('providerId', 'name phone avatar rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: bookings,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
});

/**
 * POST /bookings
 * Customer creates a new booking
 */
/**
 * POST /bookings/validate-coupon
 * Frontend can call this before submitting the booking to check coupon validity
 */
router.post('/validate-coupon', authenticate, authorize('customer'), async (req, res) => {
  const { couponCode, serviceId } = req.body;
  if (!couponCode || !serviceId) throw new AppError('couponCode and serviceId are required', 400);

  const service = await Service.findById(serviceId).lean();
  if (!service || !service.isActive) throw new AppError('Service not found', 404);

  const result = await bookingService.applyCoupon(couponCode, req.userId, service.basePrice);
  res.json({
    success: true,
    message: `Coupon valid! You save ₹${result.discountAmount}`,
    data: {
      code: result.coupon.code,
      discountAmount: result.discountAmount,
      discountType: result.coupon.discountType,
    },
  });
});

router.post('/', authenticate, authorize('customer'), bookingRateLimiter, validateBody(createBookingSchema), async (req, res) => {
  const {
    serviceId, scheduledDate, timeSlot,
    serviceAddress, customerNotes, couponCode,
  } = req.body;

  // FIX #5: Wrap booking + coupon in a Mongoose session to prevent partial state
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const service = await Service.findById(serviceId).session(session);
    if (!service || !service.isActive) throw new AppError('Service not available', 404);

    // Fetch user to check for Plus Membership
    const user = await User.findById(req.userId).session(session);
    const isPlusMember = user?.subscription?.plan === 'premium';

    // Validate and apply coupon
    let discountAmount = 0;
    let appliedCoupon = null;
    
    if (isPlusMember) {
      discountAmount += Math.round(service.basePrice * 0.1); // 10% off for Plus members
    }

    if (couponCode) {
      const couponResult = await bookingService.applyCoupon(
        couponCode, req.userId, service.basePrice
      );
      discountAmount += couponResult.discountAmount;
      appliedCoupon = couponResult.coupon;
    }

    // Create booking
    const booking = new Booking({
      customerId: req.userId,
      serviceId,
      scheduledDate,
      timeSlot,
      serviceAddress: {
        ...serviceAddress,
        location: {
          type: 'Point',
          coordinates: serviceAddress.location.coordinates,
        },
      },
      basePrice: service.basePrice,
      discountAmount,
      couponCode: appliedCoupon?.code,
      customerNotes,
      commissionRate: parseInt(process.env.DEFAULT_COMMISSION_PERCENT || '20'),
      status: 'pending',
    });

    // Smart surge pricing (Free for Plus Members) — wrapped in try/catch to prevent geo-index crash
    let surgeMultiplier = 1.0;
    if (!isPlusMember) {
      try {
        surgeMultiplier = await bookingService.calculateSurgePricing(
          serviceId, scheduledDate, serviceAddress.location.coordinates
        );
      } catch (surgeErr) {
        logger.warn('Surge pricing calculation failed, defaulting to 1.0x:', surgeErr.message);
        surgeMultiplier = 1.0;
      }
    }
    booking.surgeMultiplier = surgeMultiplier;

    await booking.save({ session });

    // Update coupon usage within the same transaction
    if (appliedCoupon) {
      await bookingService.recordCouponUsage(appliedCoupon._id, req.userId, session);
    }

    await session.commitTransaction();
    session.endSession();

    // Queue provider matching (async — don't block response)
    const { bookingQueue } = require('../../jobs');
    await bookingQueue.add('match_provider', {
      bookingId: booking._id.toString(),
      coordinates: serviceAddress.location.coordinates,
      serviceId,
      attempt: 1,
    }, { delay: 0, attempts: 5, backoff: { type: 'exponential', delay: 10000 } });

    logger.info(`Booking ${booking.bookingNumber} created, queued for matching`);

    const bookingData = booking.toObject({ virtuals: true });
    
    res.status(201).json({
      success: true,
      message: 'Booking created. Finding the best provider for you...',
      data: {
        bookingId: bookingData._id.toString(),
        bookingNumber: bookingData.bookingNumber,
        status: bookingData.status,
        estimatedTotal: bookingData.totalAmount,
        surgeMultiplier,
      },
    });
  } catch (err) {
    if (session) {
      if (session.inTransaction()) await session.abortTransaction();
      await session.endSession();
    }
    // FIX: Sanitize error to prevent "Converting circular structure to JSON"
    // Raw database/mongoose errors can contain the session object which is circular.
    const sanitizedError = new AppError(err.message, err.status || 500, err.errorCode || 'BOOKING_ERROR');
    sanitizedError.stack = err.stack; // stack is a string, so it's safe
    throw sanitizedError;
  }
});

/**
 * GET /bookings/:id
 * Get booking details
 */
router.get('/:id', authenticate, async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('serviceId')
    .populate('customerId', 'name phone avatar')
    .populate('providerId', 'name phone avatar rating currentLocation')
    .lean();

  if (!booking) throw new AppError('Booking not found', 404);

  // Authorization check
  const isOwner = booking.customerId?._id?.toString() === req.userId ||
    booking.providerId?._id?.toString() === req.userId;
  if (!isOwner && req.userRole !== 'admin') {
    throw new AppError('Not authorized to view this booking', 403);
  }

  // Include materials if job is completed
  let materials = null;
  if (['completed', 'paid'].includes(booking.status)) {
    materials = await MaterialsUsed.findOne({ bookingId: booking._id }).lean();
  }

  res.json({ success: true, data: { booking, materials } });
});

/**
 * PUT /bookings/:id/accept
 * Provider accepts a booking
 */
router.put('/:id/accept', authenticate, authorize('provider'), async (req, res) => {
  const booking = await Booking.findById(req.params.id).populate('serviceId');
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) {
    throw new AppError('This booking was not assigned to you', 403);
  }
  if (booking.status !== 'assigned') {
    throw new AppError(`Cannot accept booking with status: ${booking.status}`, 400);
  }

  // Check daily limit (max 5 jobs per day)
  const bookingStart = new Date(booking.scheduledDate);
  const startOfDay = new Date(bookingStart);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(bookingStart);
  endOfDay.setHours(23, 59, 59, 999);

  const dailyJobsCount = await Booking.countDocuments({
    providerId: req.userId,
    status: { $in: ['accepted', 'in_progress', 'completed', 'paid'] },
    scheduledDate: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });

  if (dailyJobsCount >= 5) {
    throw new AppError('Cannot accept: You have reached the maximum limit of 5 jobs per day.', 400);
  }

  booking.status = 'accepted';
  booking.timeline.push({ status: 'accepted', note: 'Provider accepted the booking' });
  await booking.save();

  // ── Set active booking cache so live GPS tracking works ──────────────────
  await cache.set(`active_booking:provider:${req.userId}`, {
    bookingId: booking._id.toString(),
    customerId: booking.customerId.toString(),
    serviceAddress: booking.serviceAddress,
  }, 4 * 60 * 60); // 4 hour TTL

  // Notify customer
  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:accepted', {
    bookingId: booking._id,
    bookingNumber: booking.bookingNumber,
    providerId: req.userId,
    message: 'Your service provider has accepted the booking!',
  });

  res.json({ success: true, message: 'Booking accepted', data: { status: booking.status } });
});

/**
 * PUT /bookings/:id/reject
 * Provider rejects — triggers auto-reassignment
 */
router.put('/:id/reject', authenticate, authorize('provider'), async (req, res) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) {
    throw new AppError('This booking was not assigned to you', 403);
  }
  if (!['assigned', 'accepted'].includes(booking.status)) {
    throw new AppError('Cannot reject this booking', 400);
  }

  booking.rejectedProviders.push(req.userId);
  booking.status = 'pending';
  booking.providerId = undefined;
  booking.timeline.push({ status: 'pending', note: `Provider rejected: ${reason || 'No reason given'}` });
  await booking.save();

  // Auto-offline penalty for rejections
  const provider = await Provider.findById(req.userId);
  if (provider) {
    const missedCount = parseInt(await cache.get(`provider_missed:${provider._id}`) || 0) + 1;
    if (missedCount >= 2) {
      provider.isOnline = false;
      await provider.save();
      await cache.del(`provider_missed:${provider._id}`);
      
      const io = getIO();
      // Notify them their status has changed
      io.to(`user:${provider._id}`).emit('notification:push', { 
        title: 'Status Changed', 
        body: 'You have been taken Offline after rejecting multiple requests.' 
      });
    } else {
      await cache.set(`provider_missed:${provider._id}`, missedCount, 3600);
    }
  }

  // Re-queue for matching with excluded providers
  const { bookingQueue } = require('../../jobs');
  await bookingQueue.add('match_provider', {
    bookingId: booking._id.toString(),
    coordinates: booking.serviceAddress.location.coordinates,
    serviceId: booking.serviceId.toString(),
    attempt: booking.assignmentAttempts + 1,
    excludeProviders: booking.rejectedProviders.map(String),
  }, { delay: 2000 });

  res.json({ success: true, message: 'Booking rejected. Finding another provider.' });
});

// Helper for Geo-fencing
function haversineDistance(coord1, coord2) {
  const [lng1, lat1] = coord1;
  const [lng2, lat2] = coord2;
  const R = 6371; // Earth ratio in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * PUT /bookings/:id/start
 * Provider starts the job (OTP + Geo-fence)
 */
router.put('/:id/start', authenticate, authorize('provider'), async (req, res) => {
  const { otp, lat, lng } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'accepted') throw new AppError('Cannot start job at this stage', 400);

  // FIX #9: Always enforce startOtp — no silent skip if booking has no OTP set
  if (!otp) {
    throw new AppError('Start OTP is required. Please ask the customer for the OTP sent to their phone.', 400);
  }
  if (booking.startOtp && booking.startOtp !== otp) {
    throw new AppError('Invalid OTP', 400);
  }

  // Geofencing verification (500 metres max distance)
  if (!lat || !lng) throw new AppError('Location coordinates (lat, lng) are required to start the job.', 400);
  const customerLocation = booking.serviceAddress?.location?.coordinates;
  if (customerLocation?.length === 2) {
    const distanceKm = haversineDistance([Number(lng), Number(lat)], customerLocation);
    if (distanceKm > 0.5) {
      throw new AppError(`You are ${(distanceKm * 1000).toFixed(0)}m away from the customer. Please reach the location to start.`, 400);
    }
  }

  // Generate a 4-digit PIN the customer will read to the provider
  const endOtp = Math.floor(1000 + Math.random() * 9000).toString();

  booking.status = 'in_progress';
  booking.workDetails.startedAt = new Date();
  booking.endOtp = endOtp;  // stored for verification at completion
  booking.timeline.push({ status: 'in_progress', note: 'Job started' });
  await booking.save();

  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:status_update', {
    bookingId: booking._id,
    status: 'in_progress',
    endOtp,                     // customer sees the PIN in real-time
    message: `Service started! Your completion PIN is ${endOtp} — share it with the provider when done.`,
  });

  res.json({
    success: true,
    message: 'Job started',
    data: { startedAt: booking.workDetails.startedAt },
  });
});

/**
 * POST /bookings/:id/materials
 * Provider adds materials used
 */
router.post('/:id/materials', authenticate, authorize('provider'), validateBody(addMaterialsSchema), async (req, res) => {
  const { items, notes } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'in_progress') throw new AppError('Can only add materials while job is in progress', 400);

  // Upsert materials entry
  const materialsDoc = await MaterialsUsed.findOneAndUpdate(
    { bookingId: booking._id },
    {
      bookingId: booking._id,
      providerId: req.userId,
      customerId: booking.customerId,
      items,
      notes,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Update booking material cost
  booking.materialCost = materialsDoc.subtotal;
  await booking.save();

  // Notify customer to approve materials list
  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:materials_added', {
    bookingId: booking._id,
    materialCost: materialsDoc.subtotal,
    items,
    message: 'Please review and approve the materials used.',
  });

  res.json({
    success: true,
    message: 'Materials saved',
    data: {
      materialsId: materialsDoc._id,
      items: materialsDoc.items,
      subtotal: materialsDoc.subtotal,
    },
  });
});

/**
 * PUT /bookings/:id/materials/approve
 * Customer approves materials
 */
router.put('/:id/materials/approve', authenticate, authorize('customer'), async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);

  const materials = await MaterialsUsed.findOneAndUpdate(
    { bookingId: booking._id },
    { customerApproved: true, approvedAt: new Date() },
    { new: true }
  );
  if (!materials) throw new AppError('No materials record found', 404);

  res.json({ success: true, message: 'Materials approved', data: { subtotal: materials.subtotal } });
});

/**
 * PUT /bookings/:id/complete
 * Provider marks job as complete
 */
router.put('/:id/complete', authenticate, authorize('provider'), validateBody(completeBookingSchema), async (req, res) => {
  const { workPerformed, extraCharges, extraChargesNote, afterPhotos, endOtp, lat, lng } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'in_progress') throw new AppError('Job not in progress', 400);

  // Geofencing verification (500 metres max distance)
  if (!lat || !lng) throw new AppError('Location coordinates (lat, lng) are required to complete the job.', 400);
  const customerLocation = booking.serviceAddress?.location?.coordinates;
  if (customerLocation?.length === 2) {
    const distanceKm = haversineDistance([Number(lng), Number(lat)], customerLocation);
    if (distanceKm > 0.5) {
      throw new AppError(`You are ${(distanceKm * 1000).toFixed(0)}m away from the customer. Please remain at the location to complete.`, 400);
    }
  }

  // Verify 4-digit completion PIN shared by customer
  if (booking.endOtp) {
    if (!endOtp) {
      throw new AppError('PIN is required. Please ask the customer for the 4-digit completion PIN.', 400);
    }
    if (booking.endOtp !== String(endOtp).trim()) {
      throw new AppError('Invalid PIN. Please ask the customer for the correct 4-digit PIN.', 400);
    }
  }

  booking.status = 'completed';
  booking.workDetails.workPerformed = workPerformed;
  booking.workDetails.completedAt = new Date();
  booking.workDetails.afterPhotos = afterPhotos || [];
  booking.extraCharges = extraCharges || 0;
  booking.extraChargesNote = extraChargesNote;
  booking.timeline.push({ status: 'completed', note: 'Job completed by provider' });
  await booking.save();

  // Clear active booking cache so GPS tracking stops
  await cache.del(`active_booking:provider:${req.userId}`);

  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:completed', {
    bookingId: booking._id,
    totalAmount: booking.totalAmount,
    message: 'Service completed! Please proceed to payment.',
  });

  res.json({
    success: true,
    message: 'Job marked as complete',
    data: {
      bookingId: booking._id,
      totalAmount: booking.totalAmount,
      breakdown: {
        basePrice: booking.basePrice,
        surgeMultiplier: booking.surgeMultiplier,
        materialCost: booking.materialCost,
        extraCharges: booking.extraCharges,
        discount: booking.discountAmount,
        total: booking.totalAmount,
      },
    },
  });
});

/**
 * PUT /bookings/:id/cancel
 * Cancel a booking
 */
router.put('/:id/cancel', authenticate, async (req, res) => {
  const { reason } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);

  const cancelableStatuses = ['pending', 'assigned', 'accepted'];
  if (!cancelableStatuses.includes(booking.status)) {
    throw new AppError('Booking cannot be cancelled at this stage', 400);
  }

  // Check authorization
  const isCustomer = booking.customerId?.toString() === req.userId && req.userRole === 'customer';
  const isProvider = booking.providerId?.toString() === req.userId && req.userRole === 'provider';
  const isAdmin = req.userRole === 'admin';
  if (!isCustomer && !isProvider && !isAdmin) throw new AppError('Not authorized', 403);

  let cancelledBy = isAdmin ? 'admin' : (isCustomer ? 'customer' : 'provider');

  // Strict Provider Penalties for abandoning an accepted job
  if (cancelledBy === 'provider' && booking.status === 'accepted') {
    const provider = await Provider.findById(req.userId);
    if (provider) {
      provider.cancelledJobs = (provider.cancelledJobs || 0) + 1;
      provider.riskScore = Math.min((provider.riskScore || 0) + 15, 100);
      provider.warningCount = (provider.warningCount || 0) + 1;
      provider.warnings.push({
        reason: `Abandoned accepted booking ${booking.bookingNumber}`,
        issuedAt: new Date()
      });
      await provider.save();
      
      // 1-hour auto-timeout penalty so they don't get new jobs
      await cache.set(`provider:timeout:${provider._id}`, true, 3600);
    }
  }

  // Calculate cancellation charge (only applicable if customer cancels)
  let cancellationCharge = 0;
  if (cancelledBy === 'customer') {
    cancellationCharge = bookingService.calculateCancellationCharge(booking);
  }

  booking.status = 'cancelled';
  booking.cancellation = {
    cancelledBy,
    reason,
    cancelledAt: new Date(),
    cancellationCharge,
    refundAmount: booking.totalAmount - cancellationCharge,
  };
  booking.timeline.push({ status: 'cancelled', note: `Cancelled by ${cancelledBy}: ${reason || 'No reason given'}` });
  await booking.save();

  // Clear active booking cache if provider is cancelling
  if (cancelledBy === 'provider' && booking.providerId) {
    await cache.del(`active_booking:provider:${booking.providerId}`);
  }

  // Trigger refund if payment was made
  if (booking.cancellation.refundAmount > 0) {
    const { paymentQueue } = require('../../jobs');
    paymentQueue.add('process_refund', {
      bookingId: booking._id.toString(),
      refundAmount: booking.cancellation.refundAmount,
    });
  }

  res.json({
    success: true,
    message: 'Booking cancelled',
    data: {
      refundAmount: booking.cancellation.refundAmount,
      cancellationCharge,
    },
  });
});

/**
 * GET /bookings/:id/invoice
 * Download PDF invoice
 */
router.get('/:id/invoice', authenticate, async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('serviceId', 'name category')
    .populate('customerId', 'name phone email')
    .populate('providerId', 'name phone')
    .lean();

  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.status !== 'paid') throw new AppError('Invoice only available for paid bookings', 400);

  const materials = await MaterialsUsed.findOne({ bookingId: booking._id }).lean();
  const transaction = await require('../../models').Transaction.findOne({
    bookingId: booking._id, status: 'success',
  }).lean();

  const pdfBuffer = await pdfService.generateInvoice({ booking, materials, transaction });

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename=invoice-${booking.bookingNumber}.pdf`,
    'Content-Length': pdfBuffer.length,
  });
  res.send(pdfBuffer);
});

/**
 * GET /bookings/:id/track
 * Real-time provider location (polling fallback)
 */
router.get('/:id/track', authenticate, authorize('customer'), async (req, res) => {
  const booking = await Booking.findById(req.params.id).select('providerId status');
  if (!booking) throw new AppError('Booking not found', 404);
  if (!['accepted', 'in_progress'].includes(booking.status)) {
    throw new AppError('Tracking only available when provider is en route', 400);
  }

  const locationData = await cache.get(`provider_location:${booking.providerId}`);
  if (!locationData) {
    return res.json({ success: true, data: null, message: 'Provider location not available' });
  }

  res.json({ success: true, data: locationData });
});

module.exports = router;
