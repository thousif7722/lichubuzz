'use strict';
const express = require('express');
const Joi = require('joi');
const { Complaint, Booking } = require('../../models');
const { authenticate } = require('../auth/auth.routes');
const { validateBody } = require('../../middleware/validate');
const { AppError } = require('../../utils/errors');
const { getLeastBusyStaff } = require('../../utils/assignment');
const router = express.Router();

const complaintSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required(),
  category: Joi.string().valid('overcharging','poor_quality','no_show','behaviour','damage','safety','fraud','other').required(),
  description: Joi.string().min(20).max(1000).required(),
  evidence: Joi.array().items(Joi.string()).optional(),
});

router.post('/', authenticate, validateBody(complaintSchema), async (req, res) => {
  const { bookingId, category, description, evidence } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);

  const isCustomer = booking.customerId.toString() === req.userId;
  const isProvider = booking.providerId?.toString() === req.userId;
  if (!isCustomer && !isProvider) throw new AppError('Forbidden', 403);

  const againstUser = isCustomer ? booking.providerId : booking.customerId;
  const againstRole = isCustomer ? 'provider' : 'customer';

  const assignedStaffId = await getLeastBusyStaff('manage_complaints', 'complaint');

  const complaint = await Complaint.create({
    bookingId, category, description, evidence,
    raisedBy: req.userId, againstUser, againstRole,
    severity: ['fraud', 'safety', 'damage'].includes(category) ? 'high' : 'medium',
    autoFlagged: category === 'overcharging',
    assignedTo: assignedStaffId || undefined,
  });

  if (['in_progress', 'completed'].includes(booking.status)) {
    await Booking.findByIdAndUpdate(bookingId, { status: 'disputed' });
  }

  res.status(201).json({ success: true, message: 'Complaint filed. We will review within 24 hours.', data: { ticketNumber: complaint.ticketNumber } });
});

router.get('/my', authenticate, async (req, res) => {
  const complaints = await Complaint.find({ raisedBy: req.userId })
    .populate('bookingId', 'bookingNumber scheduledDate')
    .sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: complaints });
});

router.get('/:ticketNumber', authenticate, async (req, res) => {
  const complaint = await Complaint.findOne({ ticketNumber: req.params.ticketNumber })
    .populate('raisedBy', 'name phone')
    .populate('bookingId').lean();
  if (!complaint) throw new AppError('Complaint not found', 404);
  res.json({ success: true, data: complaint });
});

router.post('/:id/comment', authenticate, async (req, res) => {
  const { text } = req.body;
  if (!text) throw new AppError('Comment text required', 400);
  const complaint = await Complaint.findByIdAndUpdate(
    req.params.id,
    { $push: { comments: { author: req.userId, role: req.userRole, text } } },
    { new: true }
  );
  if (!complaint) throw new AppError('Complaint not found', 404);
  res.json({ success: true, data: complaint });
});

module.exports = router;
