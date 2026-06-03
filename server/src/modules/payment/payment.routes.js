'use strict';
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Booking, Transaction, Provider, User, WalletLedger } = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const { cache } = require('../../config/redis');
const { getIO } = require('../../socket');
const logger = require('../../utils/logger');
const pdfService = require('../../services/pdf.service');
const { s3Service } = require('../../services/s3.service');
const { notificationQueue } = require('../../jobs');

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Idempotency Middleware ─────────────────────────────────────────────────────
async function checkIdempotency(req, res, next) {
  const key = req.headers['x-idempotency-key'];
  if (!key) return next();

  const cached = await cache.get(`idempotency:${key}`);
  if (cached) {
    logger.info(`Idempotent response returned for key: ${key}`);
    return res.status(cached.status).json(cached.body);
  }

  // Store idempotency result in res.locals for later caching
  res.locals.idempotencyKey = key;
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    cache.set(`idempotency:${key}`, { status: res.statusCode, body }, 86400); // 24h
    return originalJson(body);
  };

  next();
}

// ── Create Payment Order ───────────────────────────────────────────────────────
router.post('/create-order', authenticate, authorize('customer'), checkIdempotency, async (req, res) => {
  const { bookingId, paymentMethod = 'online' } = req.body;
  if (!bookingId) throw new AppError('Booking ID required', 400);

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'completed') throw new AppError('Payment only for completed bookings', 400);

  // Check if already paid
  const existingTxn = await Transaction.findOne({
    bookingId, type: 'payment', status: 'success',
  });
  if (existingTxn) throw new AppError('Booking already paid', 400);

  if (paymentMethod === 'cash') {
    return handleCashPayment(req, res, booking);
  }

  // Create Razorpay order
  const amountPaise = Math.round(booking.totalAmount * 100); // Convert to paise
  const rzpOrder = await razorpay.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: booking.bookingNumber,
    notes: {
      bookingId: booking._id.toString(),
      customerId: req.userId,
    },
  });

  // Create pending transaction
  const transaction = await Transaction.create({
    bookingId: booking._id,
    userId: req.userId,
    providerId: booking.providerId,
    type: 'payment',
    amount: booking.totalAmount,
    status: 'pending',
    razorpayOrderId: rzpOrder.id,
    paymentMethod: 'online',
    idempotencyKey: res.locals.idempotencyKey,
  });

  res.json({
    success: true,
    data: {
      orderId: rzpOrder.id,
      transactionId: transaction.transactionId,
      amount: amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      bookingNumber: booking.bookingNumber,
      prefill: {
        name: (await User.findById(req.userId))?.name,
        contact: booking.customerId,
      },
    },
  });
});

// ── Cash Payment Handler ───────────────────────────────────────────────────────
async function handleCashPayment(req, res, booking) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const transaction = await Transaction.create([{
      bookingId: booking._id,
      userId: booking.customerId,
      providerId: booking.providerId,
      type: 'payment',
      amount: booking.totalAmount,
      status: 'success',
      paymentMethod: 'cash',
      platformAmount: booking.platformFee,
      providerAmount: booking.providerEarnings,
    }], { session });

    await splitEarnings(booking, transaction[0], session);
    booking.status = 'paid';
    booking.timeline.push({ status: 'paid', note: 'Cash payment recorded' });
    await booking.save({ session });

    await generateAndStoreInvoice(booking, transaction[0]);

    await session.commitTransaction();
    session.endSession();

    const io = getIO();
    io.to(`user:${booking.customerId}`).emit('booking:paid', {
      bookingId: booking._id,
      message: 'Cash payment recorded. Thank you!',
    });

    res.json({ success: true, message: 'Cash payment recorded', data: { transactionId: transaction[0].transactionId } });
  } catch (err) {
    if (session) {
      if (session.inTransaction()) await session.abortTransaction();
      await session.endSession();
    }
    // Sanitize error to prevent circular JSON structure (session/MongoClient) leaks
    const sanitizedError = new AppError(err.message, err.status || 500);
    sanitizedError.stack = err.stack;
    throw sanitizedError;
  }
}

// ── Verify Razorpay Payment ────────────────────────────────────────────────────
router.post('/verify', authenticate, authorize('customer'), async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, bookingId } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError('Payment verification data incomplete', 400);
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    throw new AppError('Payment signature mismatch. Possible fraud attempt.', 400);
  }

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.status === 'paid') {
      return res.json({ success: true, message: 'Payment already processed' });
    }

    // Update transaction
    const transaction = await Transaction.findOneAndUpdate(
      { bookingId, razorpayOrderId },
      {
        razorpayPaymentId,
        razorpaySignature,
        status: 'success',
        platformAmount: booking.platformFee,
        providerAmount: booking.providerEarnings,
      },
      { new: true }
    );

    if (!transaction) throw new AppError('Transaction record not found', 404);

    // Split earnings
    await splitEarnings(booking, transaction);

    booking.status = 'paid';
    booking.timeline.push({ status: 'paid', note: 'Online payment successful' });
    await booking.save();

    // Async: generate invoice, notify
    setImmediate(async () => {
      try {
        await generateAndStoreInvoice(booking, transaction);
        await notificationQueue.add('payment_success', {
          bookingId: booking._id.toString(),
          userId: booking.customerId.toString(),
          amount: booking.totalAmount,
        });
      } catch (e) {
        logger.error('Post-payment async tasks failed:', e);
      }
    });

    const io = getIO();
    io.to(`user:${booking.customerId}`).emit('booking:paid', {
      bookingId: booking._id,
      amount: booking.totalAmount,
      message: 'Payment successful! Thank you.',
    });
    io.to(`provider:${booking.providerId}`).emit('payment:received', {
      bookingId: booking._id,
      earnings: booking.providerEarnings,
      message: `Payment received for booking ${booking.bookingNumber}`,
    });

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: {
        transactionId: transaction.transactionId,
        amount: booking.totalAmount,
        providerEarnings: booking.providerEarnings,
      },
    });
  } catch (err) {
    throw err;
  }
});

// ── Razorpay Webhook (raw body) ────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  // Verify webhook signature
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(req.body) // raw body buffer
    .digest('hex');

  if (signature !== expectedSig) {
    logger.warn('Invalid Razorpay webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(req.body.toString());
  logger.info(`Razorpay webhook: ${event.event}`);

  // Idempotency: skip duplicate webhooks
  const webhookKey = `webhook:${event.payload?.payment?.entity?.id || event.event}`;
  const alreadyProcessed = await cache.setNX(webhookKey, '1', 86400);
  if (!alreadyProcessed) {
    return res.json({ received: true, skipped: 'duplicate' });
  }

  switch (event.event) {
    case 'payment.captured': {
      const payment = event.payload.payment.entity;
      await Transaction.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        { razorpayPaymentId: payment.id, status: 'success' }
      );
      break;
    }
    case 'payment.failed': {
      const payment = event.payload.payment.entity;
      await Transaction.findOneAndUpdate(
        { razorpayOrderId: payment.order_id },
        { status: 'failed', failureReason: payment.error_description }
      );
      break;
    }
    case 'refund.processed': {
      const refund = event.payload.refund.entity;
      await Transaction.findOneAndUpdate(
        { razorpayPaymentId: refund.payment_id, type: 'refund' },
        { status: 'success', razorpayRefundId: refund.id }
      );
      break;
    }
  }

  res.json({ received: true });
});

// ── Refund ─────────────────────────────────────────────────────────────────────
router.post('/refund', authenticate, authorize('admin'), async (req, res) => {
  const { bookingId, amount, reason } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);

  const originalTxn = await Transaction.findOne({
    bookingId, type: 'payment', status: 'success',
  });
  if (!originalTxn) throw new AppError('No successful payment found', 404);
  if (!originalTxn.razorpayPaymentId) throw new AppError('Cash payments must be manually refunded', 400);

  const refundAmount = amount || originalTxn.amount;
  const refundAmountPaise = Math.round(refundAmount * 100);

  const rzpRefund = await razorpay.payments.refund(originalTxn.razorpayPaymentId, {
    amount: refundAmountPaise,
    notes: { reason, bookingId: bookingId.toString() },
  });

  await Transaction.create({
    bookingId: booking._id,
    userId: booking.customerId,
    type: 'refund',
    amount: refundAmount,
    status: 'processing',
    razorpayPaymentId: originalTxn.razorpayPaymentId,
    razorpayRefundId: rzpRefund.id,
    paymentMethod: 'online',
    metadata: { reason, initiatedBy: req.userId },
  });

  logger.info(`Refund initiated: ₹${refundAmount} for booking ${booking.bookingNumber}`);
  res.json({ success: true, message: `Refund of ₹${refundAmount} initiated`, data: { refundId: rzpRefund.id } });
});

// ── Commission Split Logic ─────────────────────────────────────────────────────
async function splitEarnings(booking, transaction, session = null) {
  const providerId = booking.providerId;
  const providerEarnings = booking.providerEarnings;
  const platformFee = booking.platformFee;
  const isCash = transaction?.paymentMethod === 'cash';

  // Credit or Debit provider wallet based on payment mode
  const provider = await Provider.findById(providerId).session(session);
  if (provider) {
    if (isCash) {
      // Provider collected 100% cash physically.
      // They owe the platform its commission — track as pending debt.
      provider.earnings.totalEarnings += providerEarnings;
      provider.earnings.pendingCommission = (provider.earnings.pendingCommission || 0) + platformFee;
      provider.earnings.totalCommissionPaid += 0; // Not paid yet
      provider.completedJobs += 1;

      // Start the 3-day due clock if not already running
      if (!provider.earnings.commissionDueSince) {
        provider.earnings.commissionDueSince = new Date();
      }

      // Wallet ledger: debit as "commission owed" (doesn't affect balance until settled)
      await WalletLedger.create([{
        ownerId: providerId,
        ownerType: 'provider',
        transactionId: transaction?._id,
        type: 'debit',
        amount: platformFee,
        balance: provider.earnings.walletBalance,
        description: `Platform commission due (cash) for booking ${booking.bookingNumber} — Pay within 3 days`,
        referenceType: 'booking',
        referenceId: booking._id,
      }], { session });
    } else {
      // Admin collected 100% money digitally. Owe provider their earnings.
      provider.earnings.walletBalance += providerEarnings;
      provider.earnings.totalEarnings += providerEarnings;
      provider.earnings.pendingSettlement += providerEarnings;
      provider.earnings.totalCommissionPaid += platformFee; // Commission auto-captured
      provider.completedJobs += 1;

      // Wallet ledger entry (Credit)
      await WalletLedger.create([{
        ownerId: providerId,
        ownerType: 'provider',
        transactionId: transaction?._id,
        type: 'credit',
        amount: providerEarnings,
        balance: provider.earnings.walletBalance,
        description: `Earnings credited for online booking ${booking.bookingNumber}`,
        referenceType: 'booking',
        referenceId: booking._id,
      }], { session });
    }
    await provider.save({ session });
  }

  // Record platform commission entry
  if (transaction) {
    await Transaction.create([{
      bookingId: booking._id,
      userId: booking.customerId,
      providerId: booking.providerId,
      type: 'commission',
      amount: platformFee,
      status: isCash ? 'pending' : 'success', // Cash commission is pending until provider pays
      paymentMethod: transaction.paymentMethod,
      metadata: { commissionRate: booking.commissionRate, cashDue: isCash },
    }], { session });
  }

  // Update customer stats
  await User.findByIdAndUpdate(booking.customerId, {
    $inc: { totalBookings: 1, totalSpent: booking.totalAmount },
  }, { session });

  // Update provider tier
  if (provider) {
    await updateProviderTier(provider, session);
  }
}

async function updateProviderTier(provider, session = null) {
  let tier = 'bronze';
  if (provider.completedJobs >= 100 && provider.rating >= 4.5) tier = 'gold';
  else if (provider.completedJobs >= 30 && provider.rating >= 4.0) tier = 'silver';

  if (provider.tier !== tier) {
    provider.tier = tier;
    await provider.save({ session });
    logger.info(`Provider ${provider._id} upgraded to ${tier}`);
  }
}

// ── Generate & Store Invoice ───────────────────────────────────────────────────
async function generateAndStoreInvoice(booking, transaction) {
  try {
    const fullBooking = await Booking.findById(booking._id)
      .populate('serviceId', 'name category')
      .populate('customerId', 'name phone email')
      .populate('providerId', 'name phone')
      .lean();
    const materials = await require('../../models').MaterialsUsed.findOne({ bookingId: booking._id }).lean();
    const pdfBuffer = await pdfService.generateInvoice({ booking: fullBooking, materials, transaction });
    const key = `invoices/${booking.bookingNumber}.pdf`;
    const invoiceUrl = await s3Service.upload(key, pdfBuffer, 'application/pdf');
    await Transaction.findByIdAndUpdate(transaction._id, { invoiceUrl });
    logger.info(`Invoice generated: ${invoiceUrl}`);
    return invoiceUrl;
  } catch (err) {
    logger.error('Invoice generation failed:', err);
  }
}

// ── Get Provider Wallet ────────────────────────────────────────────────────────
router.get('/wallet', authenticate, authorize('provider'), async (req, res) => {
  const provider = await Provider.findById(req.userId).select('earnings').lean();
  if (!provider) throw new AppError('Provider not found', 404);

  const recentTransactions = await WalletLedger.find({ ownerId: req.userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  res.json({ success: true, data: { earnings: provider.earnings, recentTransactions } });
});

// ── Provider Withdrawal Request ────────────────────────────────────────────────
router.post('/withdraw', authenticate, authorize('provider'), async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount < 100) throw new AppError('Minimum withdrawal is ₹100', 400);

  const provider = await Provider.findById(req.userId);
  if (!provider) throw new AppError('Provider not found', 404);
  if (!provider.earnings.bankAccount?.verified) throw new AppError('Bank account not verified', 400);
  if (provider.earnings.walletBalance < amount) throw new AppError('Insufficient wallet balance', 400);

  // Deduct from wallet, create settlement record
  provider.earnings.walletBalance -= amount;
  provider.earnings.pendingSettlement -= amount;
  await provider.save();

  await Transaction.create({
    userId: null,
    providerId: provider._id,
    type: 'settlement',
    amount,
    status: 'processing',
    paymentMethod: 'bank_transfer',
    metadata: { bankAccount: provider.earnings.bankAccount },
  });

  await WalletLedger.create({
    ownerId: provider._id,
    ownerType: 'provider',
    type: 'debit',
    amount,
    balance: provider.earnings.walletBalance,
    description: `Withdrawal request of ₹${amount}`,
    referenceType: 'settlement',
  });

  res.json({ success: true, message: `Withdrawal of ₹${amount} initiated. Will be transferred in 2-3 business days.` });
});

// ── Provider Confirms Cash Received ───────────────────────────────────────────
/**
 * PUT /payments/bookings/:id/cash-confirm
 * Technician confirms they received the cash from customer.
 * Called from provider's job card after completing the job.
 */
router.put('/bookings/:id/cash-confirm', authenticate, authorize('provider'), async (req, res) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.providerId?.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'completed') throw new AppError('Job must be completed before recording payment', 400);

  // Check if already paid
  const existingTxn = await Transaction.findOne({ bookingId: booking._id, type: 'payment', status: 'success' });
  if (existingTxn) throw new AppError('Payment already recorded', 400);

  // Create cash payment transaction
  const transaction = await Transaction.create({
    bookingId: booking._id,
    userId: booking.customerId,
    providerId: booking.providerId,
    type: 'payment',
    amount: booking.totalAmount,
    status: 'success',
    paymentMethod: 'cash',
    platformAmount: booking.platformFee,
    providerAmount: booking.providerEarnings,
    metadata: { confirmedByProvider: true, confirmedAt: new Date() },
  });

  // Split earnings (platform fee debited from provider wallet since they hold the cash)
  await splitEarnings(booking, transaction);

  booking.status = 'paid';
  booking.timeline.push({ status: 'paid', note: 'Cash payment confirmed by technician' });
  await booking.save();

  // Notify customer
  const io = getIO();
  io.to(`user:${booking.customerId}`).emit('booking:paid', {
    bookingId: booking._id,
    message: 'Cash payment confirmed. Thank you!',
    paymentMethod: 'cash',
  });
  // Notify provider (self) for UI update
  io.to(`provider:${req.userId}`).emit('payment:received', {
    bookingId: booking._id,
    earnings: booking.providerEarnings,
    paymentMethod: 'cash',
    message: `Cash received for booking #${booking.bookingNumber}`,
  });

  logger.info(`Provider ${req.userId} confirmed cash for booking ${booking.bookingNumber}`);

  res.json({
    success: true,
    message: 'Cash payment confirmed',
    data: {
      transactionId: transaction.transactionId,
      earnings: booking.providerEarnings,
      platformFee: booking.platformFee,
    },
  });
});

// ── Provider: Check Payment Status for a completed booking ─────────────────────
/**
 * GET /payments/bookings/:id/status
 * Provider polls this to see if customer paid online already.
 */
router.get('/bookings/:id/status', authenticate, authorize('provider'), async (req, res) => {
  const booking = await Booking.findById(req.params.id).select('status totalAmount providerEarnings bookingNumber').lean();
  if (!booking) throw new AppError('Booking not found', 404);

  const txn = await Transaction.findOne({
    bookingId: req.params.id,
    type: 'payment',
    status: 'success',
  }).select('paymentMethod amount createdAt').lean();

  res.json({
    success: true,
    data: {
      bookingStatus: booking.status,
      isPaid: !!txn,
      paymentMethod: txn?.paymentMethod || null,
      paidAt: txn?.createdAt || null,
      totalAmount: booking.totalAmount,
      providerEarnings: booking.providerEarnings,
    },
  });
});

module.exports = router;
