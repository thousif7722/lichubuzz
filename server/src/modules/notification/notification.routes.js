'use strict';
const express = require('express');
const { Notification } = require('../../models');
const { authenticate } = require('../auth/auth.routes');
const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const filter = { userId: req.userId };
  if (unreadOnly === 'true') filter.isRead = false;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
    Notification.countDocuments({ userId: req.userId, isRead: false }),
  ]);
  res.json({ success: true, data: notifications, unreadCount });
});

router.put('/read-all', authenticate, async (req, res) => {
  await Notification.updateMany({ userId: req.userId, isRead: false }, { isRead: true });
  res.json({ success: true, message: 'All notifications marked as read' });
});

router.put('/:id/read', authenticate, async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.userId }, { isRead: true });
  res.json({ success: true });
});

module.exports = router;
