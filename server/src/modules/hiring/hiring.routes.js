'use strict';
const express = require('express');
const { Candidate, User, Provider } = require('../../models');
const { authenticate, authorize, requirePermission } = require('../auth/auth.routes');
const { AppError } = require('../../utils/errors');
const logger = require('../../utils/logger');

const router = express.Router();

// ── Public Routes ──────────────────────────────────────────────────────────────

// Public endpoint for candidates to apply
router.post('/apply', async (req, res) => {
  const { name, phone, email, roleApplied, skills, city, experienceLevel } = req.body;
  if (!name || !phone || !roleApplied) {
    throw new AppError('Name, phone, and roleApplied are required', 400);
  }

  // Check if they already applied
  const existing = await Candidate.findOne({ phone });
  if (existing) {
    throw new AppError('An application with this phone number already exists', 400);
  }

  const candidate = await Candidate.create({
    name,
    phone,
    email,
    roleApplied,
    skills,
    city,
    experienceLevel,
  });

  res.status(201).json({ success: true, message: 'Application submitted successfully', data: candidate });
});

// ── Protected Admin/Staff Routes ───────────────────────────────────────────────

router.use(authenticate, authorize('admin', 'staff'), requirePermission('manage_providers'));

// Get all candidates
router.get('/candidates', async (req, res) => {
  const { status, role } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (role) filter.roleApplied = role;

  const candidates = await Candidate.find(filter)
    .populate('interviewerId', 'name email phone')
    .sort('-createdAt');

  res.json({ success: true, data: candidates });
});

// Update candidate status
router.put('/candidates/:id/status', async (req, res) => {
  const { status, interviewDate, interviewerId } = req.body;
  const candidate = await Candidate.findByIdAndUpdate(
    req.params.id,
    { status, interviewDate, interviewerId },
    { new: true, runValidators: true }
  ).populate('interviewerId', 'name email');

  if (!candidate) throw new AppError('Candidate not found', 404);

  res.json({ success: true, message: `Candidate moved to ${status}`, data: candidate });
});

// Convert selected candidate into User (Staff) or Provider (Technician)
router.post('/candidates/:id/onboard', authorize('admin'), async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);
  if (!candidate) throw new AppError('Candidate not found', 404);
  if (candidate.status !== 'selected') throw new AppError('Candidate must be in "selected" status to onboard', 400);

  // Check if already registered
  const existingUser = await User.findOne({ phone: candidate.phone });
  const existingProvider = await Provider.findOne({ phone: candidate.phone });
  if (existingUser || existingProvider) {
    throw new AppError('Phone number already exists in the system', 400);
  }

  let newAccount;

  // Onboard as Provider (Technician)
  if (candidate.roleApplied === 'technician') {
    newAccount = await Provider.create({
      name: candidate.name,
      phone: candidate.phone,
      email: candidate.email,
      city: candidate.city || 'Bangalore',
      state: 'KA',
      approvalStatus: 'pending',
    });
  } 
  // Onboard as Employee (Manager, Team Leader, Intern)
  else {
    let role = 'staff';
    if (candidate.roleApplied === 'intern') role = 'intern';
    if (candidate.roleApplied === 'manager') role = 'manager';
    if (candidate.roleApplied === 'team_leader') role = 'team_leader';

    newAccount = await User.create({
      name: candidate.name,
      phone: candidate.phone,
      email: candidate.email,
      role: role,
    });
  }

  // Mark as onboarded
  candidate.status = 'onboarded';
  await candidate.save();

  res.json({ success: true, message: `${candidate.name} successfully onboarded!`, data: newAccount });
});

module.exports = router;
