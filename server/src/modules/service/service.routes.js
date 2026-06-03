'use strict';
const express = require('express');
const { Service } = require('../../models');
const { cache } = require('../../config/redis');
const router = express.Router();

// Category image & icon map (matches frontend public assets)
const CATEGORY_META = {
  'AC Repair':        { img: '/cat_ac.png',        icon: '❄️',  color: '#0284c7' },
  'Cleaning':         { img: '/cat_cleaning.png',  icon: '🧹',  color: '#059669' },
  'Washing Machine':  { img: '/cat_washing.png',   icon: '🫧',  color: '#3b82f6' },
  'Fridge & Cooler':  { img: '/cat_fridge.png',    icon: '🧊',  color: '#0ea5e9' },
  'Plumbing':         { img: '/cat_plumbing.png',  icon: '🔧',  color: '#475569' },
  'Electrical':       { img: '/cat_electrical.png',icon: '⚡',  color: '#d97706' },
  'Pest Control':     { img: '/cat_pest.png',       icon: '🐛',  color: '#65a30d' },
  'Carpentry':        { img: '/cat_carpentry.png', icon: '🪚',  color: '#ea580c' },
  'Painting':         { img: '/cat_painting.png',  icon: '🎨',  color: '#db2777' },
  'Salon':            { img: '/cat_salon.png',      icon: '💇',  color: '#7c3aed' },
};

/**
 * GET /services
 * Returns all active services, optionally filtered by category & search
 * Supports sort: price_asc, price_desc, popular (default)
 */
router.get('/', async (req, res) => {
  const { category, search, sort = 'popular' } = req.query;
  const cacheKey = `services:${category || 'all'}:${search || ''}:${sort}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached, cached: true });

  const filter = { isActive: true };
  if (category) filter.category = category;
  if (search) filter.$or = [
    { name: { $regex: search, $options: 'i' } },
    { tags: { $in: [new RegExp(search, 'i')] } },
    { description: { $regex: search, $options: 'i' } },
  ];

  const sortMap = {
    price_asc: { basePrice: 1 },
    price_desc: { basePrice: -1 },
    popular: { popularityScore: -1, sortOrder: 1 },
  };

  const services = await Service.find(filter)
    .sort(sortMap[sort] || sortMap.popular)
    .lean();

  await cache.set(cacheKey, services, 300);
  res.json({ success: true, data: services });
});

/**
 * GET /services/categories
 * Returns rich category list with image, icon, color, and service count
 */
router.get('/categories', async (req, res) => {
  const cacheKey = 'service:categories:rich';
  const cached = await cache.get(cacheKey);
  if (cached) return res.json({ success: true, data: cached });

  // Aggregate service count per category
  const counts = await Service.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map(c => [c._id, c.count]));

  const categoryNames = Object.keys(countMap);
  const categories = categoryNames.map(name => ({
    name,
    slug: encodeURIComponent(name),
    serviceCount: countMap[name] || 0,
    ...(CATEGORY_META[name] || { img: null, icon: '🔧', color: '#6b7280' }),
  }));

  // Sort by display order defined in CATEGORY_META
  const order = Object.keys(CATEGORY_META);
  categories.sort((a, b) => {
    const ia = order.indexOf(a.name);
    const ib = order.indexOf(b.name);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  await cache.set(cacheKey, categories, 600);
  res.json({ success: true, data: categories });
});

/**
 * GET /services/:id
 * Returns a single service by ID
 */
router.get('/:id', async (req, res) => {
  const service = await Service.findById(req.params.id).lean();
  if (!service) return res.status(404).json({ success: false, error: 'Service not found' });
  res.json({ success: true, data: service });
});

module.exports = router;
