'use strict';
const express = require('express');
const { Attendance, User, Provider } = require('../../models');
const { authenticate } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const dayjs = require('dayjs');

const router = express.Router();

router.use(authenticate); // Accessible to all logged-in users

// Clock In
router.post('/check-in', async (req, res) => {
  const { coordinates } = req.body; // [lng, lat]
  const today = dayjs().format('YYYY-MM-DD');

  // Check if already checked in today
  let attendance = await Attendance.findOne({ userId: req.userId, date: today });
  
  if (attendance && attendance.checkIn) {
    throw new AppError('Already checked in today', 400);
  }

  if (!attendance) {
    attendance = new Attendance({
      userId: req.userId,
      userModel: req.userRole === 'customer' || req.userRole === 'technician' ? 'Provider' : 'User', // Wait, providers use the same token route? Actually we need to verify.
      date: today,
    });
  }

  // Fallback for userModel
  attendance.userModel = (req.userRole === 'customer' || req.userRole === 'technician') ? 'Provider' : 'User';

  attendance.checkIn = new Date();
  attendance.status = 'present';
  
  if (coordinates && coordinates.length === 2) {
    attendance.location = {
      type: 'Point',
      coordinates
    };
  }

  await attendance.save();

  // Update Provider / User availability to 'available'
  if (req.userRole === 'technician' || req.userRole === 'customer') {
     await Provider.findByIdAndUpdate(req.userId, { availability: 'available' });
  } else {
     await User.findByIdAndUpdate(req.userId, { availability: 'available' });
  }

  res.json({ success: true, message: 'Checked in successfully', data: attendance });
});

// Clock Out
router.post('/check-out', async (req, res) => {
  const today = dayjs().format('YYYY-MM-DD');

  const attendance = await Attendance.findOne({ userId: req.userId, date: today });
  
  if (!attendance || !attendance.checkIn) {
    throw new AppError('Cannot check out without checking in first', 400);
  }

  if (attendance.checkOut) {
    throw new AppError('Already checked out today', 400);
  }

  attendance.checkOut = new Date();
  await attendance.save();

  // Update availability to 'offline'
  if (req.userRole === 'technician' || req.userRole === 'customer') {
     await Provider.findByIdAndUpdate(req.userId, { availability: 'offline' });
  } else {
     await User.findByIdAndUpdate(req.userId, { availability: 'offline' });
  }

  res.json({ success: true, message: 'Checked out successfully', data: attendance });
});

// Get My Attendance (Monthly)
router.get('/me', async (req, res) => {
  const { month } = req.query; // YYYY-MM
  const query = { userId: req.userId };
  
  if (month) {
    query.date = { $regex: `^${month}` };
  }

  const records = await Attendance.find(query).sort('-date');
  res.json({ success: true, data: records });
});

module.exports = router;
