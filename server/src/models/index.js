'use strict';
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// ══════════════════════════════════════════════════════════════════════════════
// USER MODEL
// ══════════════════════════════════════════════════════════════════════════════
const AddressSchema = new mongoose.Schema({
  label: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
  line1: { type: String, required: true },
  line2: String,
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  isDefault: { type: Boolean, default: false },
}, { _id: true });

const UserSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true, index: true },
  name: { type: String, trim: true },
  email: { type: String, lowercase: true, sparse: true },
  avatar: String,
  role: { type: String, enum: ['customer', 'admin', 'staff', 'manager', 'team_leader', 'intern'], default: 'customer' },
  permissions: [{ type: String }], // Used for 'staff' role
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
  hierarchyLevel: { type: Number, default: 0 },
  addresses: [AddressSchema],
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
    expiresAt: Date,
    features: [String],
  },
  referralCode: { type: String, unique: true, sparse: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  walletBalance: { type: Number, default: 0, min: 0 },
  isBlocked: { type: Boolean, default: false },
  blockReason: String,
  fcmToken: String,           // Push notifications
  lastSeen: Date,
  totalBookings: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  deviceInfo: {
    platform: String,
    version: String,
    deviceId: String,
  },
  availability: { type: String, enum: ['available', 'busy', 'offline'], default: 'offline' },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

UserSchema.index({ 'addresses.location': '2dsphere' });

// ══════════════════════════════════════════════════════════════════════════════
// PROVIDER MODEL
// ══════════════════════════════════════════════════════════════════════════════
const KYCSchema = new mongoose.Schema({
  aadhaarNumber: String,
  aadhaarDoc: String,       // S3 URL
  panNumber: String,
  panDoc: String,
  selfie: String,
  status: {
    type: String,
    enum: ['pending', 'submitted', 'verified', 'rejected'],
    default: 'pending',
  },
  rejectionReason: String,
  verifiedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Staff handling KYC
});

const EarningsSchema = new mongoose.Schema({
  totalEarnings: { type: Number, default: 0 },
  pendingSettlement: { type: Number, default: 0 },
  totalCommissionPaid: { type: Number, default: 0 },
  walletBalance: { type: Number, default: 0 },          // Can be negative (pending commission debt)
  pendingCommission: { type: Number, default: 0 },      // Cash commission owed to platform
  commissionDueSince: { type: Date, default: null },    // When commission debt started
  isOnHold: { type: Boolean, default: false },          // Job hold due to unpaid commission
  bankAccount: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    accountHolder: String,
    verified: { type: Boolean, default: false },
  },
}, { _id: false });

const ProviderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, lowercase: true },
  avatar: String,

  // Service capabilities
  services: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  specializations: [String],
  experience: { type: Number, default: 0 }, // Years

  // Location
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number] }, // [lng, lat]
    updatedAt: Date,
  },
  serviceRadius: { type: Number, default: 10 }, // km
  city: String,
  state: String,

  // Status
  isOnline: { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'suspended'],
    default: 'pending',
    index: true,
  },
  isBlocked: { type: Boolean, default: false },
  blockReason: String,

  // KYC
  kyc: KYCSchema,

  // Performance
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  cancelledJobs: { type: Number, default: 0 },
  warningCount: { type: Number, default: 0 },
  warnings: [{
    reason: String,
    issuedAt: Date,
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],

  // Ranking
  tier: { type: String, enum: ['bronze', 'silver', 'gold'], default: 'bronze' },

  // Earnings
  earnings: { type: EarningsSchema, default: {} },

  // Availability
  availability: {
    monday: { from: String, to: String, available: { type: Boolean, default: true } },
    tuesday: { from: String, to: String, available: { type: Boolean, default: true } },
    wednesday: { from: String, to: String, available: { type: Boolean, default: true } },
    thursday: { from: String, to: String, available: { type: Boolean, default: true } },
    friday: { from: String, to: String, available: { type: Boolean, default: true } },
    saturday: { from: String, to: String, available: { type: Boolean, default: true } },
    sunday: { from: String, to: String, available: { type: Boolean, default: false } },
  },

  // Fraud
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  fcmToken: String,
  deviceInfo: { platform: String, version: String },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

ProviderSchema.index({ currentLocation: '2dsphere' });
ProviderSchema.index({ services: 1, isOnline: 1, approvalStatus: 1 });
ProviderSchema.index({ rating: -1, completedJobs: -1 });

// ══════════════════════════════════════════════════════════════════════════════
// SERVICE CATALOG MODEL
// ══════════════════════════════════════════════════════════════════════════════
const ServiceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  category: { type: String, required: true, index: true },
  subcategory: String,
  description: { type: String, required: true },
  icon: String,
  image: String,
  basePrice: { type: Number, required: true, min: 0 },
  priceType: { type: String, enum: ['fixed', 'hourly', 'quote'], default: 'fixed' },
  duration: { type: Number, default: 60 }, // minutes
  isActive: { type: Boolean, default: true, index: true },
  tags: [String],
  faqs: [{ question: String, answer: String }],
  includes: [String],
  excludes: [String],
  sortOrder: { type: Number, default: 0 },
  popularityScore: { type: Number, default: 0 },
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// BOOKING MODEL
// ══════════════════════════════════════════════════════════════════════════════
const TimelineEventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  note: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId },
}, { _id: false });

const BookingSchema = new mongoose.Schema({
  bookingNumber: { type: String, unique: true, index: true },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Provider',
    index: true,
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },

  // Scheduling
  scheduledDate: { type: Date, required: true },
  timeSlot: {
    from: { type: String, required: true }, // "10:00"
    to: { type: String, required: true },   // "11:00"
  },

  // Address
  serviceAddress: {
    line1: { type: String, required: true },
    line2: String,
    city: String,
    state: String,
    pincode: String,
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
  },

  // Status lifecycle
  status: {
    type: String,
    enum: [
      'pending',       // Waiting for provider assignment
      'assigned',      // System assigned a provider
      'accepted',      // Provider accepted
      'in_progress',   // Work started
      'completed',     // Work done, awaiting payment
      'paid',          // Payment received
      'cancelled',     // Cancelled by customer/provider/system
      'disputed',      // Under complaint
    ],
    default: 'pending',
    index: true,
  },
  timeline: [TimelineEventSchema],

  // Pricing
  basePrice: { type: Number, required: true },
  materialCost: { type: Number, default: 0 },
  extraCharges: { type: Number, default: 0 },
  extraChargesNote: String,
  discountAmount: { type: Number, default: 0 },
  couponCode: String,
  surgeMultiplier: { type: Number, default: 1.0 },
  totalAmount: { type: Number },
  platformFee: { type: Number, default: 0 },
  providerEarnings: { type: Number, default: 0 },
  commissionRate: { type: Number, default: 20 }, // %

  // Cancellation
  cancellation: {
    cancelledBy: { type: String, enum: ['customer', 'provider', 'system', 'admin'] },
    reason: String,
    cancelledAt: Date,
    refundAmount: { type: Number, default: 0 },
    cancellationCharge: { type: Number, default: 0 },
  },

  // Assignment tracking (for retry logic)
  assignmentAttempts: { type: Number, default: 0 },
  rejectedProviders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Provider' }],
  assignmentTimeout: Date,

  // Work details
  workDetails: {
    issueDescription: String,
    workPerformed: String,
    startedAt: Date,
    completedAt: Date,
    beforePhotos: [String],
    afterPhotos: [String],
  },

  // OTP for verification
  startOtp: String,
  endOtp: String,

  // Rating
  isRated: { type: Boolean, default: false },

  // Notes
  customerNotes: String,
  internalNotes: String,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

BookingSchema.index({ 'serviceAddress.location': '2dsphere' });
BookingSchema.index({ customerId: 1, status: 1, createdAt: -1 });
BookingSchema.index({ providerId: 1, status: 1, scheduledDate: 1 });
BookingSchema.index({ scheduledDate: 1, status: 1 });

// Auto-generate booking number
BookingSchema.pre('save', async function (next) {
  if (!this.bookingNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    this.bookingNumber = `SH${ts}${rand}`;
  }
  // Calculate total
  this.totalAmount = (
    this.basePrice * (this.surgeMultiplier || 1) +
    (this.materialCost || 0) +
    (this.extraCharges || 0) -
    (this.discountAmount || 0)
  );
  // Calculate commission
  this.platformFee = Math.round(this.totalAmount * (this.commissionRate / 100));
  this.providerEarnings = this.totalAmount - this.platformFee;
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// MATERIALS USED MODEL
// ══════════════════════════════════════════════════════════════════════════════
const MaterialItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, default: 'pcs' },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number },
  brand: String,
  isProviderOwned: { type: Boolean, default: true }, // false = customer-supplied
}, { _id: true });

MaterialItemSchema.pre('save', function (next) {
  this.totalPrice = this.quantity * this.unitPrice;
  next();
});

const MaterialsUsedSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
  },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [MaterialItemSchema],
  subtotal: { type: Number, default: 0 },
  customerApproved: { type: Boolean, default: false },
  approvedAt: Date,
  disputeRaised: { type: Boolean, default: false },
  disputeNote: String,
  notes: String,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
});

MaterialsUsedSchema.pre('save', function (next) {
  this.subtotal = this.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// TRANSACTION MODEL
// ══════════════════════════════════════════════════════════════════════════════
const TransactionSchema = new mongoose.Schema({
  transactionId: { type: String, unique: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider' },

  type: {
    type: String,
    enum: [
      'payment',         // Customer pays
      'refund',          // Refund to customer
      'commission',      // Platform commission deducted
      'wallet_credit',   // Provider wallet top-up
      'wallet_debit',    // Provider withdrawal
      'settlement',      // Provider payout
      'cancellation_fee',
    ],
    required: true,
  },

  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },

  // Razorpay fields
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  razorpayRefundId: String,

  paymentMethod: { type: String, enum: ['online', 'cash', 'wallet'] },
  gateway: { type: String, default: 'razorpay' },

  // Idempotency
  idempotencyKey: { type: String, unique: true, sparse: true },

  // Tax
  gstRate: { type: Number, default: 18 },
  gstAmount: { type: Number, default: 0 },

  // Split
  platformAmount: Number,
  providerAmount: Number,

  failureReason: String,
  metadata: mongoose.Schema.Types.Mixed,
  invoiceUrl: String,
}, {
  timestamps: true,
});

TransactionSchema.pre('save', function (next) {
  if (!this.transactionId) {
    this.transactionId = `TXN${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  this.gstAmount = Math.round(this.amount * (this.gstRate / 100));
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// REVIEW MODEL
// ══════════════════════════════════════════════════════════════════════════════
const ReviewSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true,
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Provider', required: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },

  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 500 },
  photos: [String],

  aspects: {
    punctuality: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    behaviour: { type: Number, min: 1, max: 5 },
    cleanliness: { type: Number, min: 1, max: 5 },
  },

  providerResponse: {
    text: String,
    respondedAt: Date,
  },

  isVisible: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: true },
  helpfulCount: { type: Number, default: 0 },
  flagged: { type: Boolean, default: false },
  flagReason: String,
}, { timestamps: true });

ReviewSchema.index({ providerId: 1, isVisible: 1, createdAt: -1 });
ReviewSchema.index({ customerId: 1, createdAt: -1 });

// Update provider rating after review save
ReviewSchema.post('save', async function () {
  const Provider = mongoose.model('Provider');
  const stats = await mongoose.model('Review').aggregate([
    { $match: { providerId: this.providerId, isVisible: true } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  if (stats.length > 0) {
    await Provider.findByIdAndUpdate(this.providerId, {
      rating: Math.round(stats[0].avgRating * 10) / 10,
      ratingCount: stats[0].count,
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPLAINT MODEL
// ══════════════════════════════════════════════════════════════════════════════
const ComplaintSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
  raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  againstUser: { type: mongoose.Schema.Types.ObjectId },    // Customer or Provider
  againstRole: { type: String, enum: ['customer', 'provider'] },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Staff handling complaint

  category: {
    type: String,
    enum: [
      'overcharging',
      'poor_quality',
      'no_show',
      'behaviour',
      'damage',
      'safety',
      'fraud',
      'other',
    ],
    required: true,
  },
  description: { type: String, required: true, maxlength: 1000 },
  evidence: [String], // S3 URLs

  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: {
    type: String,
    enum: ['open', 'in_review', 'resolved', 'escalated', 'closed'],
    default: 'open',
    index: true,
  },

  resolution: {
    action: String,
    refundAmount: Number,
    note: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
  },

  escalations: [{
    escalatedTo: String,
    escalatedAt: Date,
    reason: String,
  }],

  comments: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: String,
    text: String,
    createdAt: { type: Date, default: Date.now },
  }],

  autoFlagged: { type: Boolean, default: false },
  fraudRisk: { type: Number, default: 0 },
}, { timestamps: true });

ComplaintSchema.pre('save', async function (next) {
  if (!this.ticketNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    this.ticketNumber = `CMP${ts}${rand}`;
  }
  next();
});

// ══════════════════════════════════════════════════════════════════════════════
// WALLET LEDGER MODEL
// ══════════════════════════════════════════════════════════════════════════════
const WalletLedgerSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  ownerType: { type: String, enum: ['customer', 'provider'], required: true },
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true, min: 0 },
  balance: { type: Number, required: true }, // Balance after this transaction
  description: { type: String, required: true },
  referenceType: String, // 'booking', 'refund', 'settlement', etc.
  referenceId: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// COUPON MODEL
// ══════════════════════════════════════════════════════════════════════════════
const CouponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  description: String,
  discountType: { type: String, enum: ['flat', 'percent'], required: true },
  discountValue: { type: Number, required: true },
  maxDiscount: Number,           // For percent type
  minOrderValue: { type: Number, default: 0 },
  usageLimit: { type: Number, default: 1 },
  usedCount: { type: Number, default: 0 },
  userLimit: { type: Number, default: 1 }, // Per user
  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },
  applicableServices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  isActive: { type: Boolean, default: true },
  usedBy: [{ userId: mongoose.Schema.Types.ObjectId, usedAt: Date }],
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION MODEL
// ══════════════════════════════════════════════════════════════════════════════
const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'booking_update', 'payment', 'otp', 'chat',
      'promotional', 'system', 'review', 'complaint', 'announcement',
    ],
  },
  isBroadcast: { type: Boolean, default: false },
  referenceType: String,
  referenceId: mongoose.Schema.Types.ObjectId,
  isRead: { type: Boolean, default: false },
  channels: {
    push: { sent: Boolean, sentAt: Date },
    sms: { sent: Boolean, sentAt: Date },
    email: { sent: Boolean, sentAt: Date },
  },
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// HR & TEAM HIERARCHY MODELS
// ══════════════════════════════════════════════════════════════════════════════
const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: String,
  department: String,
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });



const AttendanceSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userModel: { type: String, enum: ['User', 'Provider'], required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  checkIn: Date,
  checkOut: Date,
  status: { type: String, enum: ['present', 'absent', 'leave'], default: 'present' },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number], // [lng, lat]
  },
}, { timestamps: true });

// ══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ══════════════════════════════════════════════════════════════════════════════
module.exports = {
  User: mongoose.model('User', UserSchema),
  Provider: mongoose.model('Provider', ProviderSchema),
  Service: mongoose.model('Service', ServiceSchema),
  Booking: mongoose.model('Booking', BookingSchema),
  MaterialsUsed: mongoose.model('MaterialsUsed', MaterialsUsedSchema),
  Transaction: mongoose.model('Transaction', TransactionSchema),
  Review: mongoose.model('Review', ReviewSchema),
  Complaint: mongoose.model('Complaint', ComplaintSchema),
  WalletLedger: mongoose.model('WalletLedger', WalletLedgerSchema),
  Coupon: mongoose.model('Coupon', CouponSchema),
  Notification: mongoose.model('Notification', NotificationSchema),
  Team: mongoose.model('Team', TeamSchema),
  // FIX #13: Attendance was defined but missing from exports
  Attendance: mongoose.model('Attendance', AttendanceSchema),
};
