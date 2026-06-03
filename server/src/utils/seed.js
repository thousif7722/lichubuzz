'use strict';
require('dotenv').config();
const mongoose = require('mongoose');
const { User, Provider, Service, Coupon } = require('../models');
const logger = require('./logger');

const SERVICES = [
  // AC Services
  { name: 'AC Service & Cleaning', slug: 'ac-service-cleaning', category: 'Home Appliance', subcategory: 'AC', description: 'Deep cleaning and servicing of Air Conditioner.', basePrice: 499, duration: 90, tags: ['ac', 'air conditioner', 'cleaning', 'service'], icon: '❄️', isActive: true, sortOrder: 1 },
  { name: 'AC Repair', slug: 'ac-repair', category: 'Home Appliance', subcategory: 'AC', description: 'Professional AC diagnosis and repair.', basePrice: 399, duration: 60, tags: ['ac', 'repair'], icon: '❄️', isActive: true, sortOrder: 2 },
  { name: 'AC Installation & Uninstallation', slug: 'ac-install-uninstall', category: 'Home Appliance', subcategory: 'AC', description: 'Professional installation or uninstallation of AC units.', basePrice: 999, duration: 120, tags: ['ac', 'installation', 'uninstallation'], icon: '❄️', isActive: true, sortOrder: 3 },
  { name: 'AC Gas Filling', slug: 'ac-gas-filling', category: 'Home Appliance', subcategory: 'AC', description: 'Complete AC gas refill with leak check.', basePrice: 1999, duration: 90, tags: ['ac', 'gas', 'cooling'], icon: '❄️', isActive: true, sortOrder: 4 },

  // Washing Machine
  { name: 'Washing Machine Repair', slug: 'washing-machine-repair', category: 'Home Appliance', subcategory: 'Washing Machine', description: 'Repair for top-load and front-load washing machines.', basePrice: 349, duration: 60, tags: ['washing machine', 'repair'], icon: '🧺', isActive: true, sortOrder: 5 },
  { name: 'Washing Machine Installation', slug: 'washing-machine-install', category: 'Home Appliance', subcategory: 'Washing Machine', description: 'Installation setup for washing machines.', basePrice: 299, duration: 45, tags: ['washing machine', 'installation'], icon: '🧺', isActive: true, sortOrder: 6 },
  { name: 'Washing Machine Cleaning', slug: 'washing-machine-cleaning', category: 'Home Appliance', subcategory: 'Washing Machine', description: 'Deep cleaning and descaling of washing machine.', basePrice: 499, duration: 90, tags: ['washing machine', 'cleaning'], icon: '🧺', isActive: true, sortOrder: 7 },

  // Refrigerator
  { name: 'Refrigerator Cooling Issue Repair', slug: 'refrigerator-cooling-repair', category: 'Home Appliance', subcategory: 'Refrigerator', description: 'Fixing cooling issues for all types of refrigerators.', basePrice: 399, duration: 90, tags: ['refrigerator', 'cooling', 'repair'], icon: '🧊', isActive: true, sortOrder: 8 },
  { name: 'Refrigerator Gas Filling', slug: 'refrigerator-gas-filling', category: 'Home Appliance', subcategory: 'Refrigerator', description: 'Gas refill and leak repair for refrigerators.', basePrice: 1899, duration: 90, tags: ['refrigerator', 'gas'], icon: '🧊', isActive: true, sortOrder: 9 },
  { name: 'Refrigerator Service', slug: 'refrigerator-service', category: 'Home Appliance', subcategory: 'Refrigerator', description: 'General service and maintenance of refrigerator.', basePrice: 349, duration: 60, tags: ['refrigerator', 'service'], icon: '🧊', isActive: true, sortOrder: 10 },

  // Air Cooler
  { name: 'Air Cooler Repair', slug: 'cooler-repair', category: 'Home Appliance', subcategory: 'Air Cooler', description: 'Repair of air coolers including fan and pump issues.', basePrice: 249, duration: 60, tags: ['cooler', 'repair'], icon: '🌬️', isActive: true, sortOrder: 11 },
  { name: 'Air Cooler Cleaning', slug: 'cooler-cleaning', category: 'Home Appliance', subcategory: 'Air Cooler', description: 'Thorough cleaning of cooler pads and tank.', basePrice: 299, duration: 60, tags: ['cooler', 'cleaning'], icon: '🌬️', isActive: true, sortOrder: 12 },
  { name: 'Air Cooler Motor/Pump Fix', slug: 'cooler-motor-fix', category: 'Home Appliance', subcategory: 'Air Cooler', description: 'Replacement or repair of cooler motor/pump.', basePrice: 349, duration: 90, tags: ['cooler', 'motor', 'pump'], icon: '🌬️', isActive: true, sortOrder: 13 },
  
  // Previous services preserved for providers
  { name: 'Bathroom Cleaning', slug: 'bathroom-cleaning', category: 'Cleaning', subcategory: 'Deep Clean', description: 'Thorough bathroom deep cleaning.', basePrice: 349, duration: 60, tags: ['bathroom'], icon: '🚿', isActive: true, sortOrder: 14 },
  { name: 'Full Home Deep Clean', slug: 'full-home-deep-clean', category: 'Cleaning', subcategory: 'Deep Clean', description: 'Comprehensive home cleaning.', basePrice: 1499, duration: 240, priceType: 'quote', tags: ['home'], icon: '🏠', isActive: true, sortOrder: 15 },
  { name: 'Electrical Wiring & Repair', slug: 'electrical-wiring-repair', category: 'Electrical', subcategory: 'Wiring', description: 'Licensed electricians for wiring.', basePrice: 299, duration: 60, tags: ['electrical'], icon: '⚡', isActive: true, sortOrder: 16 },
  { name: 'Plumbing Services', slug: 'plumbing-services', category: 'Plumbing', subcategory: 'General', description: 'Expert plumbers for leaks.', basePrice: 249, duration: 60, tags: ['plumbing'], icon: '🔧', isActive: true, sortOrder: 17 },
];

const COUPONS = [
  { code: 'WELCOME50', description: '₹50 off on your first booking', discountType: 'flat', discountValue: 50, minOrderValue: 299, usageLimit: 10000, userLimit: 1, validFrom: new Date(), validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
  { code: 'SAVE20', description: '20% off up to ₹200', discountType: 'percent', discountValue: 20, maxDiscount: 200, minOrderValue: 499, usageLimit: 5000, userLimit: 3, validFrom: new Date(), validTo: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
  { code: 'NEWUSER', description: '₹100 off for new users', discountType: 'flat', discountValue: 100, minOrderValue: 399, usageLimit: 50000, userLimit: 1, validFrom: new Date(), validTo: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/servicehub');
    logger.info('Connected to MongoDB for seeding...');

    // ── Services ─────────────────────────────────────────────────────────────
    await Service.deleteMany({});
    const createdServices = await Service.insertMany(SERVICES);
    logger.info(`✅ ${createdServices.length} services seeded`);

    // ── Admin User ────────────────────────────────────────────────────────────
    await User.deleteMany({ role: 'admin' });
    const adminUser = await User.create({
      phone: '9999999999',
      name: 'ServiceHub Admin',
      email: 'admin@servicehub.in',
      role: 'admin',
      referralCode: 'ADMIN001',
    });
    logger.info(`✅ Admin user seeded: ${adminUser.phone}`);

    // ── Sample Customers ──────────────────────────────────────────────────────
    await User.deleteMany({ role: 'customer' });
    const customers = await User.insertMany([
      { phone: '9876543210', name: 'Priya Sharma', email: 'priya@example.com', role: 'customer', referralCode: 'REF0210', addresses: [{ label: 'home', line1: 'Flat 4B, Sunrise Apartments', city: 'Bangalore', state: 'Karnataka', pincode: '560001', location: { type: 'Point', coordinates: [77.5946, 12.9716] }, isDefault: true }] },
      { phone: '9876543211', name: 'Raj Kumar', email: 'raj@example.com', role: 'customer', referralCode: 'REF3211', addresses: [{ label: 'home', line1: '12, MG Road', city: 'Bangalore', state: 'Karnataka', pincode: '560025', location: { type: 'Point', coordinates: [77.6120, 12.9752] }, isDefault: true }] },
      { phone: '9876543212', name: 'Sunita Patel', email: 'sunita@example.com', role: 'customer', referralCode: 'REF3212' },
    ]);
    logger.info(`✅ ${customers.length} sample customers seeded`);

    // ── Sample Providers ──────────────────────────────────────────────────────
    await Provider.deleteMany({});
    const providerUsers = await User.insertMany([
      { phone: '8876543210', name: 'Ramesh Electricals', role: 'customer', referralCode: 'PROV001' },
      { phone: '8876543211', name: 'Clean Pro Services', role: 'customer', referralCode: 'PROV002' },
      { phone: '8876543212', name: 'AquaFix Plumbing', role: 'customer', referralCode: 'PROV003' },
    ]);

    const electricalService = createdServices.find(s => s.slug === 'electrical-wiring-repair');
    const cleaningService = createdServices.find(s => s.slug === 'bathroom-cleaning');
    const plumbingService = createdServices.find(s => s.slug === 'plumbing-services');

    await Provider.insertMany([
      { userId: providerUsers[0]._id, phone: '8876543210', name: 'Ramesh Kumar', email: 'ramesh@provider.com', services: [electricalService._id], experience: 8, city: 'Bangalore', state: 'Karnataka', isOnline: true, isAvailable: true, approvalStatus: 'approved', currentLocation: { type: 'Point', coordinates: [77.5946, 12.9720] }, rating: 4.8, ratingCount: 152, completedJobs: 312, tier: 'gold', kyc: { status: 'verified', verifiedAt: new Date() }, earnings: { totalEarnings: 245000, walletBalance: 12500, totalCommissionPaid: 61250 } },
      { userId: providerUsers[1]._id, phone: '8876543211', name: 'Cleaning Experts', email: 'cleanpro@provider.com', services: [cleaningService._id, createdServices.find(s => s.slug === 'full-home-deep-clean')._id], experience: 5, city: 'Bangalore', state: 'Karnataka', isOnline: true, isAvailable: true, approvalStatus: 'approved', currentLocation: { type: 'Point', coordinates: [77.5800, 12.9600] }, rating: 4.5, ratingCount: 89, completedJobs: 178, tier: 'silver', kyc: { status: 'verified', verifiedAt: new Date() }, earnings: { totalEarnings: 85000, walletBalance: 8200 } },
      { userId: providerUsers[2]._id, phone: '8876543212', name: 'AquaFix Team', email: 'aquafix@provider.com', services: [plumbingService._id], experience: 6, city: 'Bangalore', state: 'Karnataka', isOnline: false, isAvailable: true, approvalStatus: 'approved', currentLocation: { type: 'Point', coordinates: [77.6100, 12.9800] }, rating: 4.3, ratingCount: 67, completedJobs: 134, tier: 'bronze', kyc: { status: 'verified', verifiedAt: new Date() } },
    ]);
    logger.info(`✅ ${providerUsers.length} sample providers seeded`);

    // ── Coupons ────────────────────────────────────────────────────────────────
    await Coupon.deleteMany({});
    await Coupon.insertMany(COUPONS);
    logger.info(`✅ ${COUPONS.length} coupons seeded`);

    logger.info('\n🎉 Database seeding complete!');
    logger.info('\nTest credentials:');
    logger.info('  Admin:    phone=9999999999, OTP=123456 (dev only)');
    logger.info('  Customer: phone=9876543210, OTP=123456');
    logger.info('  Provider: phone=8876543210, OTP=123456');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

seed();
