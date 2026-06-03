'use strict';
const express = require('express');
const Joi = require('joi');
const { Review, Booking } = require('../../models');
const { authenticate, authorize } = require('../auth/auth.routes');
const { validateBody } = require('../../middleware/validate');
const { AppError } = require('../../utils/errors');
const router = express.Router();

const reviewSchema = Joi.object({
  bookingId: Joi.string().hex().length(24).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().max(500).optional(),
  photos: Joi.array().items(Joi.string().uri()).max(3).optional(),
  aspects: Joi.object({
    punctuality: Joi.number().integer().min(1).max(5).optional(),
    quality: Joi.number().integer().min(1).max(5).optional(),
    behaviour: Joi.number().integer().min(1).max(5).optional(),
    cleanliness: Joi.number().integer().min(1).max(5).optional(),
  }).optional(),
});

router.post('/', authenticate, authorize('customer'), validateBody(reviewSchema), async (req, res) => {
  const { bookingId, rating, comment, photos, aspects } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new AppError('Booking not found', 404);
  if (booking.customerId.toString() !== req.userId) throw new AppError('Forbidden', 403);
  if (booking.status !== 'paid') throw new AppError('Can only review paid bookings', 400);
  if (booking.isRated) throw new AppError('Already reviewed this booking', 400);

  const review = await Review.create({
    bookingId,
    customerId: req.userId,
    providerId: booking.providerId,
    serviceId: booking.serviceId,
    rating,
    comment,
    photos,
    aspects,
  });

  await Booking.findByIdAndUpdate(bookingId, { isRated: true });
  res.status(201).json({ success: true, message: 'Review submitted. Thank you!', data: review });
});

router.get('/provider/:providerId', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [reviews, total] = await Promise.all([
    Review.find({ providerId: req.params.providerId, isVisible: true })
      .populate('customerId', 'name avatar')
      .sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Review.countDocuments({ providerId: req.params.providerId, isVisible: true }),
  ]);
  res.json({ success: true, data: reviews, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

router.post('/:id/respond', authenticate, authorize('provider'), async (req, res) => {
  const { text } = req.body;
  if (!text) throw new AppError('Response text required', 400);
  const review = await Review.findOneAndUpdate(
    { _id: req.params.id, providerId: req.userId },
    { providerResponse: { text, respondedAt: new Date() } },
    { new: true }
  );
  if (!review) throw new AppError('Review not found or not yours', 404);
  res.json({ success: true, data: review });
});

module.exports = router;
