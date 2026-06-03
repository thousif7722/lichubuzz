'use strict';
const { Queue, Worker, QueueEvents } = require('bullmq');
const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

// ── Queue instances ────────────────────────────────────────────────────────────
let bookingQueue, paymentQueue, notificationQueue, invoiceQueue;
let workers = [];

const QUEUE_OPTIONS = {
  connection: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
};

function initQueues() {
  try {
    // ── Create Queues ────────────────────────────────────────────────────────────
    bookingQueue = new Queue('booking', QUEUE_OPTIONS);
    paymentQueue = new Queue('payment', QUEUE_OPTIONS);
    notificationQueue = new Queue('notification', QUEUE_OPTIONS);
    invoiceQueue = new Queue('invoice', QUEUE_OPTIONS);

    // ── Create Workers ───────────────────────────────────────────────────────────
    const bookingWorker = createBookingWorker();
    const paymentWorker = createPaymentWorker();
    const notificationWorker = createNotificationWorker();
    const invoiceWorker = createInvoiceWorker();

    workers = [bookingWorker, paymentWorker, notificationWorker, invoiceWorker];

    // ── Queue Event Monitoring ───────────────────────────────────────────────────
    for (const queue of [bookingQueue, paymentQueue, notificationQueue]) {
      const events = new QueueEvents(queue.name, { connection: QUEUE_OPTIONS.connection });
      events.on('failed', ({ jobId, failedReason }) => {
        logger.error(`Job ${jobId} failed in queue ${queue.name}: ${failedReason}`);
      });
      events.on('completed', ({ jobId }) => {
        logger.debug(`Job ${jobId} completed in queue ${queue.name}`);
      });
    }

    // ── Scheduled Jobs (recurring) ───────────────────────────────────────────────
    scheduleRecurringJobs();

    logger.info('✅ BullMQ queues and workers initialized');
  } catch (error) {
    logger.warn('⚠️ BullMQ queue initialization failed (Redis might be down). Application will continue without background jobs.');
    logger.debug('Queue error detail:', error);
  }
}

// ── Booking Worker ─────────────────────────────────────────────────────────────
function createBookingWorker() {
  return new Worker('booking', async (job) => {
    const { name, data } = job;
    logger.debug(`Processing booking job: ${name}`, data);

    switch (name) {
      case 'match_provider':
        return processProviderMatching(job);
      case 'booking_timeout':
        return processBookingTimeout(job);
      case 'send_otp':
        return processSendOTP(job);
      case 'check_commission_dues':
        return processCommissionDuesCheck();
      default:
        logger.warn(`Unknown booking job: ${name}`);
    }
  }, {
    ...QUEUE_OPTIONS,
    concurrency: 20,
  });
}

async function processProviderMatching(job) {
  const { bookingId, coordinates, serviceId, attempt, excludeProviders = [] } = job.data;
  const { Booking } = require('../models');
  const { assignProviderToBooking } = require('../modules/booking/booking.service');

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    logger.warn(`Booking ${bookingId} not found for provider matching`);
    return;
  }

  if (booking.status !== 'pending') {
    logger.info(`Booking ${bookingId} is no longer pending (${booking.status}), skipping match`);
    return;
  }

  const MAX_ATTEMPTS = 5;
  if (attempt > MAX_ATTEMPTS) {
    logger.warn(`Booking ${bookingId}: max matching attempts reached`);
    booking.status = 'cancelled';
    booking.cancellation = {
      cancelledBy: 'system',
      reason: 'No providers available in your area',
      cancelledAt: new Date(),
    };
    await booking.save();

    const { emitToUser } = require('../socket');
    emitToUser(booking.customerId.toString(), 'booking:no_providers', {
      bookingId,
      message: 'No providers available. Please try again or choose a different time.',
    });
    return;
  }

  const provider = await assignProviderToBooking(booking, attempt);

  if (!provider) {
    // Retry after 30 seconds
    await bookingQueue.add('match_provider', {
      ...job.data,
      attempt: attempt + 1,
    }, { delay: 30000 });
  }
}

async function processBookingTimeout(job) {
  const { bookingId, providerId } = job.data;
  const { Booking, Provider } = require('../models');
  const { emitToProvider } = require('../socket');

  const booking = await Booking.findById(bookingId);
  if (!booking || booking.status !== 'assigned') return; // Already handled

  const cachedTimeout = await require('../config/redis').cache.get(`booking_timeout:${bookingId}`);
  if (!cachedTimeout) return; // Timeout was cleared (provider accepted)

  logger.info(`Booking ${bookingId}: provider ${providerId} timed out`);

  // Add provider to rejected list
  booking.rejectedProviders.push(providerId);
  booking.status = 'pending';
  booking.providerId = undefined;
  booking.timeline.push({ status: 'pending', note: 'Provider timeout — reassigning' });
  await booking.save();

  // Auto-offline penalty
  const provider = await Provider.findById(providerId);
  if (provider) {
    const { cache } = require('../config/redis');
    const missedCount = parseInt(await cache.get(`provider_missed:${provider._id}`) || 0) + 1;
    if (missedCount >= 2) {
      provider.isOnline = false;
      await provider.save();
      await cache.del(`provider_missed:${provider._id}`);
      emitToProvider(providerId, 'notification:push', { title: 'Status Changed', body: 'You have been taken Offline after missing multiple requests.' });
    } else {
      await cache.set(`provider_missed:${provider._id}`, missedCount, 3600); // 1 hr expiry
    }
  }

  emitToProvider(providerId, 'booking:expired', { bookingId });

  // Re-queue matching
  await bookingQueue.add('match_provider', {
    bookingId,
    coordinates: booking.serviceAddress.location.coordinates,
    serviceId: booking.serviceId.toString(),
    attempt: booking.assignmentAttempts + 1,
    excludeProviders: booking.rejectedProviders.map(String),
  }, { delay: 1000 });
}

async function processSendOTP(job) {
  const { phone, otp, type } = job.data;
  const smsService = require('../services/sms.service');
  await smsService.sendOTP(phone, otp, type);
}

// ── Commission Dues Enforcement ────────────────────────────────────────────────
async function processCommissionDuesCheck() {
  const { Provider } = require('../models');
  const { emitToProvider } = require('../socket');

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - THREE_DAYS_MS);

  // Find providers with overdue cash commission (due for 3+ days, not on hold yet)
  const overdueProviders = await Provider.find({
    'earnings.pendingCommission': { $gt: 0 },
    'earnings.commissionDueSince': { $lte: cutoffDate },
  });

  for (const provider of overdueProviders) {
    if (!provider.earnings.isOnHold) {
      provider.earnings.isOnHold = true;
      await provider.save();
      logger.warn(`Provider ${provider.name} (${provider._id}) placed on HOLD — unpaid commission ₹${provider.earnings.pendingCommission}`);

      // Notify provider via socket
      emitToProvider(provider._id.toString(), 'notification:push', {
        title: '⚠️ Account On Hold',
        body: `You have ₹${provider.earnings.pendingCommission} in unpaid platform commission. Pay immediately to resume accepting jobs.`,
      });
    }
  }

  logger.info(`Commission dues check: ${overdueProviders.length} providers checked.`);
}

// ── Payment Worker ─────────────────────────────────────────────────────────────
function createPaymentWorker() {
  return new Worker('payment', async (job) => {
    const { name, data } = job;

    switch (name) {
      case 'process_refund':
        return processRefund(job);
      case 'provider_settlement':
        return processProviderSettlement(job);
      default:
        logger.warn(`Unknown payment job: ${name}`);
    }
  }, { ...QUEUE_OPTIONS, concurrency: 5 });
}

async function processRefund(job) {
  const { bookingId, refundAmount } = job.data;
  const { Booking, Transaction } = require('../models');

  const booking = await Booking.findById(bookingId);
  if (!booking) return;

  const originalTxn = await Transaction.findOne({
    bookingId, type: 'payment', status: 'success',
    razorpayPaymentId: { $exists: true },
  });

  if (!originalTxn) {
    logger.warn(`No Razorpay payment found for booking ${bookingId} — manual refund required`);
    return;
  }

  const Razorpay = require('razorpay');
  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const refund = await razorpay.payments.refund(originalTxn.razorpayPaymentId, {
      amount: Math.round(refundAmount * 100),
    });
    await Transaction.create({
      bookingId,
      userId: booking.customerId,
      type: 'refund',
      amount: refundAmount,
      status: 'processing',
      razorpayRefundId: refund.id,
      razorpayPaymentId: originalTxn.razorpayPaymentId,
      paymentMethod: 'online',
    });
    logger.info(`Refund processed: ${refund.id} for ₹${refundAmount}`);
  } catch (err) {
    logger.error(`Refund failed for booking ${bookingId}:`, err);
    throw err; // Will retry
  }
}

async function processProviderSettlement(job) {
  const { providerId, amount } = job.data;
  // In production: integrate with bank transfer API (Razorpay X, etc.)
  logger.info(`Settlement queued: ₹${amount} for provider ${providerId}`);
}

// ── Notification Worker ────────────────────────────────────────────────────────
function createNotificationWorker() {
  return new Worker('notification', async (job) => {
    const { name, data } = job;

    switch (name) {
      case 'booking_update': return sendBookingNotification(data);
      case 'payment_success': return sendPaymentNotification(data);
      case 'otp': return sendOTPNotification(data);
      case 'referral_reward': return processReferralReward(data);
      default:
        logger.warn(`Unknown notification job: ${name}`);
    }
  }, { ...QUEUE_OPTIONS, concurrency: 50 });
}

async function sendBookingNotification(data) {
  const { userId, title, body, type, referenceId } = data;
  const { Notification } = require('../models');
  const { emitToUser } = require('../socket');
  const pushService = require('../services/push.service');

  const notification = await Notification.create({
    userId,
    title,
    body,
    type: type || 'booking_update',
    referenceId,
  });

  // Real-time
  emitToUser(userId, 'notification:push', { title, body, type });

  // Push notification
  const { User } = require('../models');
  const user = await User.findById(userId).select('fcmToken').lean();
  if (user?.fcmToken) {
    try {
      await pushService.send(user.fcmToken, title, body);
      await Notification.findByIdAndUpdate(notification._id, {
        'channels.push.sent': true,
        'channels.push.sentAt': new Date(),
      });
    } catch (err) {
      logger.warn(`Push notification failed for user ${userId}:`, err.message);
    }
  }
}

async function sendPaymentNotification(data) {
  const { userId, amount, bookingId } = data;
  await sendBookingNotification({
    userId,
    title: 'Payment Successful',
    body: `Your payment of ₹${amount} has been received. Thank you!`,
    type: 'payment',
    referenceId: bookingId,
  });
}

async function sendOTPNotification(data) {
  const smsService = require('../services/sms.service');
  await smsService.sendOTP(data.phone, data.otp);
}

async function processReferralReward(data) {
  const { referrerId, newUserId } = data;
  const { User } = require('../models');

  // Credit referrer wallet (e.g., ₹50)
  const REFERRAL_REWARD = 50;
  await User.findByIdAndUpdate(referrerId, {
    $inc: { walletBalance: REFERRAL_REWARD },
  });
  logger.info(`Referral reward: ₹${REFERRAL_REWARD} credited to user ${referrerId}`);
}

// ── Invoice Worker ─────────────────────────────────────────────────────────────
function createInvoiceWorker() {
  return new Worker('invoice', async (job) => {
    const { bookingId } = job.data;
    const { Booking, Transaction } = require('../models');
    const pdfService = require('../services/pdf.service');
    const { s3Service } = require('../services/s3.service');

    const booking = await Booking.findById(bookingId)
      .populate('serviceId customerId providerId')
      .lean();
    const transaction = await Transaction.findOne({ bookingId, type: 'payment', status: 'success' }).lean();
    const materials = await require('../models').MaterialsUsed.findOne({ bookingId }).lean();

    const pdfBuffer = await pdfService.generateInvoice({ booking, materials, transaction });
    const key = `invoices/${booking.bookingNumber}.pdf`;
    const url = await s3Service.upload(key, pdfBuffer, 'application/pdf');

    await Transaction.findByIdAndUpdate(transaction?._id, { invoiceUrl: url });
    logger.info(`Invoice stored: ${url}`);
  }, { ...QUEUE_OPTIONS, concurrency: 10 });
}

// ── Recurring Scheduled Jobs ───────────────────────────────────────────────────
function scheduleRecurringJobs() {
  // Check timed-out booking assignments every minute
  bookingQueue.add('check_timeouts', {}, {
    repeat: { every: 60000 }, // Every 1 minute
    jobId: 'check_assignment_timeouts',
  });

  // Daily commission dues enforcement — 6:00 AM IST (00:30 UTC)
  bookingQueue.add('check_commission_dues', {}, {
    repeat: { cron: '30 0 * * *' },
    jobId: 'daily_commission_dues_check',
  });

  // Daily provider settlement (2 AM IST)
  paymentQueue.add('provider_settlement_batch', {}, {
    repeat: { cron: '30 20 * * *' }, // 8:30 PM UTC = 2:00 AM IST
    jobId: 'daily_settlement',
  });
}

// ── Graceful shutdown ──────────────────────────────────────────────────────────
async function shutdownQueues() {
  logger.info('Closing queue workers...');
  await Promise.all(workers.map((w) => w.close()));
  logger.info('Queue workers closed');
}

process.on('SIGTERM', shutdownQueues);

// ── Exports ───────────────────────────────────────────────────────────────────
function getQueues() {
  return { bookingQueue, paymentQueue, notificationQueue, invoiceQueue };
}

module.exports = {
  initQueues,
  get bookingQueue() { return bookingQueue; },
  get paymentQueue() { return paymentQueue; },
  get notificationQueue() { return notificationQueue; },
  get invoiceQueue() { return invoiceQueue; },
  shutdownQueues,
};
