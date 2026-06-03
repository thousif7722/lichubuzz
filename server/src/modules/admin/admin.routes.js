'use strict';
const express = require('express');
const mongoose = require('mongoose');
const {
  User, Provider, Booking, Transaction,
  Review, Complaint, Service, WalletLedger,
} = require('../../models');
const { authenticate, authorize, requirePermission } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const { cache } = require('../../config/redis');
const { emitToAdmin, getIO } = require('../../socket');
const logger = require('../../utils/logger');

const router = express.Router();

// All admin routes require authentication and admin/staff role
router.use(authenticate, authorize('admin', 'staff'));

// ── Team Management (Super Admin Only) ─────────────────────────────────────────
router.post('/team', authorize('admin'), async (req, res) => {
  const { phone, name, email, permissions } = req.body;
  if (!phone || !name || !permissions) throw new AppError('Phone, name, and permissions required', 400);

  const existing = await User.findOne({ phone });
  if (existing) throw new AppError('User with this phone already exists', 400);

  const staff = await User.create({
    phone,
    name,
    email: email || undefined,
    role: 'staff',
    permissions: Array.isArray(permissions) ? permissions : [],
  });

  res.status(201).json({ success: true, message: 'Team member added', data: staff });
});

router.get('/team', authorize('admin'), async (req, res) => {
  const team = await User.find({ role: 'staff' }).select('-__v').lean();
  res.json({ success: true, data: team });
});

router.put('/team/:id', authorize('admin'), async (req, res) => {
  const { permissions, isBlocked } = req.body;
  const updates = {};
  if (permissions) updates.permissions = permissions;
  if (isBlocked !== undefined) updates.isBlocked = isBlocked;

  const staff = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!staff) throw new AppError('Staff member not found', 404);
  res.json({ success: true, message: 'Team member updated', data: staff });
});

// ── Organization Teams & Hierarchy ───────────────────────────────────────────────
router.post('/teams', authorize('admin'), async (req, res) => {
  const { name, city, department, managerId } = req.body;
  const Team = require('../../models').Team;
  const team = await Team.create({ name, city, department, managerId });
  res.status(201).json({ success: true, message: 'Team created', data: team });
});

router.get('/teams/hierarchy', async (req, res) => {
  const Team = require('../../models').Team;
  const teams = await Team.find().populate('managerId', 'name email phone role').lean();
  res.json({ success: true, data: teams });
});

// ── Announcements & Broadcasts ─────────────────────────────────────────────────
router.post('/announcements', authorize('admin', 'staff'), async (req, res) => {
  const { title, body, targetRole, targetTeamId } = req.body;
  const Notification = require('../../models').Notification;

  const announcement = await Notification.create({
    userId: req.userId, // Sender
    title,
    body,
    type: 'announcement',
    isBroadcast: true,
    referenceType: targetRole || 'all',
    referenceId: targetTeamId || null,
  });

  // Emit socket event to targeted users
  const { getIO } = require('../../socket');
  const io = getIO();
  if (io) {
    let room = 'all_users'; // Default broad room
    if (targetRole === 'technician') room = 'providers';
    if (targetRole === 'customer') room = 'customers';
    io.to(room).emit('announcement_received', announcement);
  }

  res.status(201).json({ success: true, message: 'Announcement broadcasted successfully', data: announcement });
});

// ── Dashboard Analytics ────────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const cacheKey = 'admin:dashboard:metrics';
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    totalUsers,
    totalProviders,
    activeBookings,
    todayBookings,
    monthlyRevenue,
    todayRevenue,
    pendingKYC,
    openComplaints,
    onlineProviders,
    bookingStatusBreakdown,
    revenueByDay,
    topProviders,
    topServices,
    cancellationRate,
  ] = await Promise.all([
    User.countDocuments({ role: 'customer' }),
    Provider.countDocuments({ approvalStatus: 'approved' }),
    Booking.countDocuments({ status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] } }),
    Booking.countDocuments({ createdAt: { $gte: today } }),
    Transaction.aggregate([
      { $match: { type: 'payment', status: 'success', createdAt: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'payment', status: 'success', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Provider.countDocuments({ 'kyc.status': 'submitted', approvalStatus: 'pending' }),
    Complaint.countDocuments({ status: 'open' }),
    Provider.countDocuments({ isOnline: true }),
    Booking.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      {
        $match: {
          type: 'payment',
          status: 'success',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Provider.find({ approvalStatus: 'approved' })
      .sort({ completedJobs: -1 })
      .limit(10)
      .select('name rating completedJobs tier earnings.totalEarnings')
      .lean(),
    Booking.aggregate([
      { $group: { _id: '$serviceId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
      { $unwind: '$service' },
      { $project: { name: '$service.name', count: 1, category: '$service.category' } },
    ]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: thisMonth } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const metrics = {
    overview: {
      totalUsers,
      totalProviders,
      activeBookings,
      onlineProviders,
      pendingKYC,
      openComplaints,
    },
    bookings: {
      today: todayBookings,
      statusBreakdown: bookingStatusBreakdown.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      cancellationRate: cancellationRate[0]
        ? ((cancellationRate[0].cancelled / cancellationRate[0].total) * 100).toFixed(1)
        : 0,
    },
    revenue: {
      today: todayRevenue[0]?.total || 0,
      todayTransactions: todayRevenue[0]?.count || 0,
      monthly: monthlyRevenue[0]?.total || 0,
      monthlyTransactions: monthlyRevenue[0]?.count || 0,
    },
    charts: {
      revenueByDay,
      topProviders,
      topServices,
    },
    generatedAt: new Date().toISOString(),
  };

  await cache.set(cacheKey, metrics, 60); // Cache 1 minute
  res.json({ success: true, data: metrics });
});

// ── User Management ────────────────────────────────────────────────────────────
router.get('/users', requirePermission('manage_users'), async (req, res) => {
  const { page = 1, limit = 20, search, isBlocked, sortBy = 'createdAt', sortOrder = -1 } = req.query;
  const filter = { role: 'customer' };
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (isBlocked !== undefined) filter.isBlocked = isBlocked === 'true';

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ [sortBy]: parseInt(sortOrder) })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v')
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({ success: true, data: users, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.put('/users/:id/block', requirePermission('manage_users'), async (req, res) => {
  const { reason } = req.body;
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: true, blockReason: reason },
    { new: true }
  ).select('name phone isBlocked');
  if (!user) throw new AppError('User not found', 404);
  logger.info(`Admin blocked user ${user._id}: ${reason}`);
  res.json({ success: true, message: `User ${user.name} blocked`, data: user });
});

router.put('/users/:id/unblock', requirePermission('manage_users'), async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBlocked: false, $unset: { blockReason: '' } },
    { new: true }
  ).select('name phone isBlocked');
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, message: `User ${user.name} unblocked`, data: user });
});

// ── Provider Management ────────────────────────────────────────────────────────
router.get('/providers', requirePermission('manage_providers'), async (req, res) => {
  const { page = 1, limit = 20, search, approvalStatus, tier } = req.query;
  const filter = {};
  if (approvalStatus) filter.approvalStatus = approvalStatus;
  
  // If staff is viewing pending providers, only show ones assigned to them
  if (req.userRole === 'staff' && approvalStatus === 'pending') {
    filter['kyc.assignedTo'] = req.userId;
  }

  if (tier) filter.tier = tier;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search } },
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [providers, total] = await Promise.all([
    Provider.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('services', 'name category')
      .lean(),
    Provider.countDocuments(filter),
  ]);

  res.json({ success: true, data: providers, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.put('/providers/:id/approve', requirePermission('manage_providers'), async (req, res) => {
  const provider = await Provider.findByIdAndUpdate(
    req.params.id,
    { approvalStatus: 'approved', 'kyc.status': 'verified', 'kyc.verifiedAt': new Date(), 'kyc.verifiedBy': req.userId },
    { new: true }
  );
  if (!provider) throw new AppError('Provider not found', 404);

  // Notify provider
  const { notificationQueue } = require('../../jobs');
  await notificationQueue.add('booking_update', {
    userId: provider.userId,
    title: 'Account Approved! 🎉',
    body: 'Your ServiceHub provider account has been approved. You can now start accepting bookings!',
    type: 'system',
  });

  logger.info(`Provider ${provider._id} approved by admin ${req.userId}`);
  res.json({ success: true, message: `Provider ${provider.name} approved` });
});

router.put('/providers/:id/reject', requirePermission('manage_providers'), async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw new AppError('Rejection reason required', 400);

  const provider = await Provider.findByIdAndUpdate(
    req.params.id,
    { approvalStatus: 'rejected', 'kyc.status': 'rejected', 'kyc.rejectionReason': reason },
    { new: true }
  );
  if (!provider) throw new AppError('Provider not found', 404);
  res.json({ success: true, message: 'Provider rejected' });
});

router.put('/providers/:id/warn', async (req, res) => {
  const { reason } = req.body;
  if (!reason) throw new AppError('Warning reason required', 400);

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  provider.warnings.push({ reason, issuedAt: new Date(), issuedBy: req.userId });
  provider.warningCount += 1;

  // Auto-block after 3 warnings
  if (provider.warningCount >= 3) {
    provider.isBlocked = true;
    provider.blockReason = 'Auto-blocked: 3 warnings received';
    logger.warn(`Provider ${provider._id} auto-blocked after 3 warnings`);
  }

  await provider.save();
  res.json({
    success: true,
    message: `Warning issued (${provider.warningCount}/3)`,
    data: { warningCount: provider.warningCount, isBlocked: provider.isBlocked },
  });
});

// ── Booking Management ─────────────────────────────────────────────────────────
router.get('/bookings', requirePermission('manage_bookings'), async (req, res) => {
  const { page = 1, limit = 20, status, from, to, providerId, customerId } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (providerId) filter.providerId = providerId;
  if (customerId) filter.customerId = customerId;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate('customerId', 'name phone')
      .populate('providerId', 'name phone rating')
      .populate('serviceId', 'name category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Booking.countDocuments(filter),
  ]);

  res.json({ success: true, data: bookings, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

/**
 * PUT /admin/bookings/:id/assign
 * Admin manually assigns a provider to a booking
 */
router.put('/bookings/:id/assign', requirePermission('manage_bookings'), async (req, res) => {
  const { providerId } = req.body;
  if (!providerId) throw new AppError('providerId is required', 400);

  const [booking, provider] = await Promise.all([
    Booking.findById(req.params.id),
    Provider.findById(providerId),
  ]);

  if (!booking) throw new AppError('Booking not found', 404);
  if (!provider) throw new AppError('Provider not found', 404);
  if (provider.approvalStatus !== 'approved') throw new AppError('Provider is not approved', 400);
  if (['completed', 'paid', 'cancelled'].includes(booking.status)) {
    throw new AppError(`Cannot assign a ${booking.status} booking`, 400);
  }

  booking.providerId = provider._id;
  booking.status = 'assigned';
  booking.assignedAt = new Date();
  booking.assignedBy = req.userId; // admin who assigned
  await booking.save();

  // Invalidate booking cache
  await cache.del(`booking:${booking._id}`);

  // Notify via socket
  const io = getIO();
  if (io) {
    // Notify customer
    io.to(`user:${booking.customerId}`).emit('booking:status_update', {
      bookingId: booking._id,
      status: 'assigned',
      providerId: { _id: provider._id, name: provider.name, phone: provider.phone, rating: provider.rating },
    });
    // Notify provider
    io.to(`provider:${provider._id}`).emit('booking:new_assignment', {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
    });
  }

  logger.info(`Admin ${req.userId} assigned booking ${booking._id} to provider ${provider._id}`);

  const populated = await Booking.findById(booking._id)
    .populate('customerId', 'name phone')
    .populate('providerId', 'name phone rating')
    .populate('serviceId', 'name category icon')
    .lean();

  res.json({ success: true, message: `Booking assigned to ${provider.name}`, data: populated });
});

// ── Complaints Management ──────────────────────────────────────────────────────
router.get('/complaints', requirePermission('manage_complaints'), async (req, res) => {
  const { page = 1, limit = 20, status, severity } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;

  // Staff only see their assigned complaints (unless they want to see closed ones which might not matter, but keeping it strict)
  if (req.userRole === 'staff') {
    filter.assignedTo = req.userId;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate('bookingId', 'bookingNumber scheduledDate totalAmount status')
      .populate('raisedBy', 'name phone role')
      .populate('againstUser', 'name phone')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    Complaint.countDocuments(filter),
  ]);

  res.json({ success: true, data: complaints, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.put('/complaints/:id/reassign', requirePermission('manage_complaints'), async (req, res) => {
  const { action } = req.body; // 'reassign_provider'
  
  const complaint = await Complaint.findById(req.params.id).populate('bookingId');
  if (!complaint) throw new AppError('Complaint not found', 404);
  
  const booking = complaint.bookingId;
  if (!booking) throw new AppError('Booking not found', 404);

  if (action === 'reassign_provider') {
    // Exclude current provider
    const excluded = booking.assignmentLogs?.map(l => l.providerId.toString()) || [];
    if (booking.providerId && !excluded.includes(booking.providerId.toString())) {
      excluded.push(booking.providerId.toString());
    }

    // Reset booking state for BullMQ matching engine
    booking.status = 'pending';
    booking.providerId = null;
    booking.assignedAt = null;
    await booking.save();

    // Trigger matching engine
    const { bookingQueue } = require('../../jobs');
    await bookingQueue.add('match_provider', {
      bookingId: booking._id,
      serviceId: booking.serviceId,
      coordinates: booking.serviceAddress?.location?.coordinates || [0, 0],
      excludeProviders: excluded,
    });

    complaint.status = 'resolved';
    complaint.resolution = 'Admin initiated provider reassignment';
    await complaint.save();

    logger.info(`Complaint ${complaint._id}: Booking ${booking._id} sent for reassignment`);
    return res.json({ success: true, message: 'Booking sent for automatic reassignment' });
  }

  res.json({ success: false, message: 'Invalid action' });
});

// ── Fraud Detection ────────────────────────────────────────────────────────────
router.get('/fraud/alerts', requirePermission('manage_complaints'), async (req, res) => {
  const [
    highRiskProviders,
    frequentComplaints,
    suspiciousOvercharging,
  ] = await Promise.all([
    Provider.find({ riskScore: { $gte: 70 } })
      .select('name phone riskScore warningCount completedJobs')
      .sort({ riskScore: -1 })
      .limit(20)
      .lean(),
    Complaint.aggregate([
      { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: '$againstUser', count: { $sum: 1 }, categories: { $push: '$category' } } },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Complaint.find({ category: 'overcharging', status: 'open' })
      .populate('bookingId', 'bookingNumber totalAmount basePrice')
      .populate('raisedBy', 'name phone')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  res.json({
    success: true,
    data: { highRiskProviders, frequentComplaints, suspiciousOvercharging },
  });
});

// Auto-calculate provider risk scores (called periodically)
router.post('/fraud/recalculate-risk', requirePermission('manage_complaints'), async (req, res) => {
  const providers = await Provider.find({ approvalStatus: 'approved' }).lean();

  for (const provider of providers) {
    const [complaints30d, overchargeComplaints] = await Promise.all([
      Complaint.countDocuments({
        againstUser: provider._id,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
      Complaint.countDocuments({ againstUser: provider._id, category: 'overcharging' }),
    ]);

    let riskScore = 0;
    riskScore += Math.min(complaints30d * 10, 40);
    riskScore += Math.min(overchargeComplaints * 15, 30);
    riskScore += Math.min(provider.warningCount * 10, 30);
    if (provider.rating < 3.0 && provider.ratingCount > 10) riskScore += 20;

    riskScore = Math.min(riskScore, 100);
    await Provider.findByIdAndUpdate(provider._id, { riskScore });
  }

  res.json({ success: true, message: `Risk scores recalculated for ${providers.length} providers` });
});

// ── Commission & Financial ─────────────────────────────────────────────────────
router.get('/financials', requirePermission('manage_financials'), async (req, res) => {
  const { from, to } = req.query;
  const dateFilter = {};
  if (from) dateFilter.$gte = new Date(from);
  if (to) dateFilter.$lte = new Date(to);

  const filter = { type: 'payment', status: 'success' };
  if (from || to) filter.createdAt = dateFilter;

  const [revenue, commissions, refunds, settlements] = await Promise.all([
    Transaction.aggregate([
      { $match: { ...filter } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'commission', status: 'success', ...(from || to ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'refund', status: 'success', ...(from || to ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'settlement', ...(from || to ? { createdAt: dateFilter } : {}) } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      revenue: { amount: revenue[0]?.total || 0, transactions: revenue[0]?.count || 0 },
      commissions: { amount: commissions[0]?.total || 0, transactions: commissions[0]?.count || 0 },
      refunds: { amount: refunds[0]?.total || 0, transactions: refunds[0]?.count || 0 },
      settlements: { amount: settlements[0]?.total || 0, transactions: settlements[0]?.count || 0 },
      netRevenue: (revenue[0]?.total || 0) - (refunds[0]?.total || 0),
    },
  });
});

// ── Service Management ─────────────────────────────────────────────────────────
router.post('/services', requirePermission('manage_services'), async (req, res) => {
  const service = await Service.create(req.body);
  await cache.del('services:all'); // Invalidate cache
  res.status(201).json({ success: true, data: service });
});

router.put('/services/:id', requirePermission('manage_services'), async (req, res) => {
  const service = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
  await cache.delPattern('services:*');
  res.json({ success: true, data: service });
});

router.delete('/services/:id', requirePermission('manage_services'), async (req, res) => {
  await Service.findByIdAndUpdate(req.params.id, { isActive: false });
  await cache.delPattern('services:*');
  res.json({ success: true, message: 'Service deactivated' });
});

// ── Wallet & Commission Management ────────────────────────────────────────────

/**
 * GET /admin/providers/:id/dues
 * View a provider's pending commission dues
 */
router.get('/providers/:id/dues', requirePermission('manage_financials'), async (req, res) => {
  const provider = await Provider.findById(req.params.id)
    .select('name phone earnings.pendingCommission earnings.commissionDueSince earnings.isOnHold earnings.walletBalance')
    .lean();
  if (!provider) throw new AppError('Provider not found', 404);

  const daysOverdue = provider.earnings.commissionDueSince
    ? Math.floor((Date.now() - new Date(provider.earnings.commissionDueSince)) / (1000 * 60 * 60 * 24))
    : 0;

  // Fetch unpaid cash commission transactions
  const { Transaction } = require('../../models');
  const pendingCommissions = await Transaction.find({
    providerId: req.params.id,
    type: 'commission',
    status: 'pending',
    paymentMethod: 'cash',
  }).populate('bookingId', 'bookingNumber scheduledDate totalAmount').sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    data: {
      name: provider.name,
      phone: provider.phone,
      walletBalance: provider.earnings.walletBalance,
      pendingCommission: provider.earnings.pendingCommission || 0,
      commissionDueSince: provider.earnings.commissionDueSince,
      daysOverdue,
      isOnHold: provider.earnings.isOnHold || false,
      transactions: pendingCommissions,
    },
  });
});

/**
 * PUT /admin/providers/:id/wallet
 * Admin manually adjusts provider wallet (top-up or deduction)
 * Body: { amount: Number, type: 'credit'|'debit', reason: String }
 */
router.put('/providers/:id/wallet', requirePermission('manage_financials'), async (req, res) => {
  const { amount, type, reason } = req.body;
  if (!amount || amount <= 0) throw new AppError('Valid amount required', 400);
  if (!['credit', 'debit'].includes(type)) throw new AppError('type must be credit or debit', 400);
  if (!reason) throw new AppError('Reason is required', 400);

  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  const { WalletLedger } = require('../../models');

  if (type === 'credit') {
    provider.earnings.walletBalance += amount;
    // If provider had pending commission, auto-clear if wallet covers it
    if (provider.earnings.pendingCommission > 0 && provider.earnings.walletBalance >= provider.earnings.pendingCommission) {
      provider.earnings.totalCommissionPaid += provider.earnings.pendingCommission;
      provider.earnings.walletBalance -= provider.earnings.pendingCommission;
      provider.earnings.pendingCommission = 0;
      provider.earnings.commissionDueSince = null;
      provider.earnings.isOnHold = false;
      logger.info(`Admin auto-cleared commission dues for provider ${provider._id} after top-up`);
    }
  } else {
    provider.earnings.walletBalance -= amount;
  }

  await provider.save();

  await WalletLedger.create({
    ownerId: provider._id,
    ownerType: 'provider',
    type,
    amount,
    balance: provider.earnings.walletBalance,
    description: `Admin manual ${type}: ${reason}`,
    referenceType: 'admin_adjustment',
  });

  logger.info(`Admin ${req.userId} ${type}ed ₹${amount} to/from provider ${provider._id} wallet: ${reason}`);

  res.json({
    success: true,
    message: `Wallet ${type === 'credit' ? 'topped up' : 'debited'} by ₹${amount}`,
    data: {
      walletBalance: provider.earnings.walletBalance,
      pendingCommission: provider.earnings.pendingCommission,
      isOnHold: provider.earnings.isOnHold,
    },
  });
});

/**
 * PUT /admin/providers/:id/dues/clear
 * Admin marks commission as paid and lifts the job hold
 * Body: { amountPaid: Number, note: String }
 */
router.put('/providers/:id/dues/clear', requirePermission('manage_financials'), async (req, res) => {
  const { amountPaid, note } = req.body;
  const provider = await Provider.findById(req.params.id);
  if (!provider) throw new AppError('Provider not found', 404);

  const due = provider.earnings.pendingCommission || 0;
  if (due === 0) throw new AppError('No pending commission dues', 400);

  const paid = amountPaid || due;
  const { Transaction, WalletLedger } = require('../../models');

  // Mark commission transactions as settled
  await Transaction.updateMany(
    { providerId: req.params.id, type: 'commission', status: 'pending', paymentMethod: 'cash' },
    { status: 'success', metadata: { clearedBy: req.userId, clearedAt: new Date(), note } }
  );

  provider.earnings.totalCommissionPaid += paid;
  provider.earnings.pendingCommission = Math.max(0, due - paid);
  if (provider.earnings.pendingCommission === 0) {
    provider.earnings.commissionDueSince = null;
    provider.earnings.isOnHold = false;
  }
  await provider.save();

  await WalletLedger.create({
    ownerId: provider._id,
    ownerType: 'provider',
    type: 'debit',
    amount: paid,
    balance: provider.earnings.walletBalance,
    description: `Commission dues cleared by admin: ${note || 'Cash collected'}`,
    referenceType: 'commission_settlement',
  });

  // Notify provider
  const { emitToProvider } = require('../../socket');
  emitToProvider(req.params.id, 'notification:push', {
    title: '✅ Hold Lifted',
    body: `Your account hold has been removed. You can now accept new jobs!`,
  });

  logger.info(`Admin ${req.userId} cleared ₹${paid} commission dues for provider ${req.params.id}`);

  res.json({
    success: true,
    message: `Commission dues cleared. Hold ${provider.earnings.isOnHold ? 'partially lifted' : 'fully lifted'}.`,
    data: {
      pendingCommission: provider.earnings.pendingCommission,
      isOnHold: provider.earnings.isOnHold,
    },
  });
});

// ── Dynamic Pricing Control ────────────────────────────────────────────────────
router.put('/pricing/surge', requirePermission('manage_services'), async (req, res) => {
  const { serviceId, hour, multiplier } = req.body;
  if (multiplier < 1 || multiplier > 3) throw new AppError('Surge multiplier must be between 1 and 3', 400);

  const key = `surge:${serviceId}:${hour}`;
  await cache.set(key, multiplier, 3600); // 1 hour override

  res.json({ success: true, message: `Surge pricing set to ${multiplier}x for service ${serviceId} at hour ${hour}` });
});

module.exports = router;
