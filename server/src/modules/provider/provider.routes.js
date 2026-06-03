'use strict';
const express = require('express');
const multer = require('multer');
const { Provider, Booking } = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const { s3Service } = require('../../services/s3.service');
const { cache } = require('../../config/redis');
const { getLeastBusyStaff } = require('../../utils/assignment');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Provider Profile ────────────────────────────────────────────────────────────
router.get('/me', authenticate, authorize('provider'), async (req, res) => {
  const provider = await Provider.findById(req.userId)
    .populate('services', 'name category icon')
    .lean();
  if (!provider) throw new AppError('Provider not found', 404);
  res.json({ success: true, data: provider });
});

router.put('/me', authenticate, authorize('provider'), async (req, res) => {
  const allowed = ['name', 'email', 'avatar', 'specializations', 'experience', 'serviceRadius', 'city', 'state', 'availability', 'fcmToken'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  const provider = await Provider.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true });
  res.json({ success: true, data: provider });
});

// ── KYC Upload ─────────────────────────────────────────────────────────────────
router.post('/me/kyc', authenticate, authorize('provider'),
  upload.fields([
    { name: 'aadhaarDoc', maxCount: 1 },
    { name: 'panDoc', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
  async (req, res) => {
    const provider = await Provider.findById(req.userId);
    if (!provider) throw new AppError('Provider not found', 404);
    if (provider.kyc?.status === 'verified') throw new AppError('KYC already verified', 400);

    const kycUpdate = {
      aadhaarNumber: req.body.aadhaarNumber,
      panNumber: req.body.panNumber,
      status: 'submitted',
    };

    const uploadFile = async (field) => {
      if (!req.files?.[field]?.[0]) return;
      const file = req.files[field][0];
      return s3Service.upload(
        `kyc/${provider._id}/${field}_${Date.now()}`,
        file.buffer,
        file.mimetype
      );
    };

    kycUpdate.aadhaarDoc = await uploadFile('aadhaarDoc');
    kycUpdate.panDoc = await uploadFile('panDoc');
    kycUpdate.selfie = await uploadFile('selfie');

    // Auto-assign to KYC staff
    const assignedStaffId = await getLeastBusyStaff('manage_providers', 'kyc');
    if (assignedStaffId) {
      kycUpdate.assignedTo = assignedStaffId;
    }

    provider.kyc = { ...provider.kyc, ...kycUpdate };
    await provider.save();
    res.json({ success: true, message: 'KYC documents submitted for review.' });
  }
);

// ── Location + Service Radius Update ──────────────────────────────────────────
router.put('/me/location', authenticate, authorize('provider'), async (req, res) => {
  const { lat, lng, serviceRadius } = req.body;
  const update = { 'currentLocation.updatedAt': new Date() };

  if (lat !== undefined && lng !== undefined) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum) || latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      throw new AppError('Invalid coordinates', 400);
    }
    update['currentLocation.coordinates'] = [lngNum, latNum];
    update['currentLocation.type'] = 'Point';
  }

  if (serviceRadius !== undefined) {
    const radius = parseInt(serviceRadius);
    if (isNaN(radius) || radius < 1 || radius > 100) {
      throw new AppError('Service radius must be between 1 and 100 km', 400);
    }
    update.serviceRadius = radius;
  }

  const provider = await Provider.findByIdAndUpdate(req.userId, update, { new: true })
    .select('currentLocation serviceRadius isOnline');
  if (!provider) throw new AppError('Provider not found', 404);

  res.json({ success: true, data: provider });
});

// ── Availability Toggle ────────────────────────────────────────────────────────
router.put('/me/availability', authenticate, authorize('provider'), async (req, res) => {
  const { isOnline, isAvailable } = req.body;
  const update = {};
  if (isOnline !== undefined) update.isOnline = isOnline;
  if (isAvailable !== undefined) update.isAvailable = isAvailable;
  await Provider.findByIdAndUpdate(req.userId, update);
  res.json({ success: true, message: `Status updated`, data: update });
});

// ── Services Selection ─────────────────────────────────────────────────────────
router.put('/me/services', authenticate, authorize('provider'), async (req, res) => {
  const { serviceIds } = req.body;
  if (!Array.isArray(serviceIds)) throw new AppError('serviceIds must be an array', 400);
  const provider = await Provider.findByIdAndUpdate(req.userId, { services: serviceIds }, { new: true })
    .populate('services', 'name category');
  res.json({ success: true, data: { services: provider.services } });
});

// ── Bank Account ───────────────────────────────────────────────────────────────
router.put('/me/bank', authenticate, authorize('provider'), async (req, res) => {
  const { accountNumber, ifscCode, bankName, accountHolder } = req.body;
  if (!accountNumber || !ifscCode || !bankName || !accountHolder) {
    throw new AppError('All bank fields required', 400);
  }
  await Provider.findByIdAndUpdate(req.userId, {
    'earnings.bankAccount': { accountNumber, ifscCode, bankName, accountHolder, verified: false },
  });
  res.json({ success: true, message: 'Bank account saved. Will be verified in 1-2 business days.' });
});

// ── Schedule View ──────────────────────────────────────────────────────────────
router.get('/me/schedule', authenticate, authorize('provider'), async (req, res) => {
  const { date } = req.query;
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
  const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

  const bookings = await Booking.find({
    providerId: req.userId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $nin: ['cancelled'] },
  }).populate('serviceId', 'name').populate('customerId', 'name phone').sort({ scheduledDate: 1 }).lean();

  res.json({ success: true, data: bookings });
});

// ── Earnings Dashboard ─────────────────────────────────────────────────────────
router.get('/me/earnings', authenticate, authorize('provider'), async (req, res) => {
  const { period = '30d' } = req.query;
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const provider = await Provider.findById(req.userId).select('earnings tier rating completedJobs').lean();

  const [weeklyEarnings, jobBreakdown] = await Promise.all([
    require('../../models').Transaction.aggregate([
      { $match: { providerId: require('mongoose').Types.ObjectId.createFromHexString(req.userId), type: 'wallet_credit', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, amount: { $sum: '$amount' } } },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      { $match: { providerId: require('mongoose').Types.ObjectId.createFromHexString(req.userId), status: 'paid', createdAt: { $gte: since } } },
      { $group: { _id: '$serviceId', count: { $sum: 1 }, earnings: { $sum: '$providerEarnings' } } },
      { $lookup: { from: 'services', localField: '_id', foreignField: '_id', as: 'service' } },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      summary: provider.earnings,
      tier: provider.tier,
      rating: provider.rating,
      completedJobs: provider.completedJobs,
      weeklyEarnings,
      jobBreakdown,
    },
  });
});

// ── Public Profile ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const cached = await cache.get(`provider:public:${req.params.id}`);
  if (cached) return res.json({ success: true, data: cached });

  const provider = await Provider.findById(req.params.id)
    .select('name avatar rating ratingCount completedJobs tier services specializations experience city')
    .populate('services', 'name category icon')
    .lean();
  if (!provider) throw new AppError('Provider not found', 404);
  await cache.set(`provider:public:${req.params.id}`, provider, 300);
  res.json({ success: true, data: provider });
});

module.exports = router;
