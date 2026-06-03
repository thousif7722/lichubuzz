'use strict';

/**
 * ServiceHub Scalability Configuration
 * Centralized settings for high-concurrency (100 crore user target)
 */

const IS_PROD = process.env.NODE_ENV === 'production';

module.exports = {
  // Database Pool Sizes
  db: {
    maxPoolSize: IS_PROD ? 200 : 20,
    minPoolSize: IS_PROD ? 10 : 2,
    heartbeatFrequencyMS: 5000,
  },

  // Redis & Caching
  redis: {
    ttl: {
      session: 86400, // 24 hours
      booking: 3600,  // 1 hour
      providerLocation: 60, // 1 minute
    },
    scanCount: 100, // Batch size for SCAN operations
  },

  // BullMQ Concurrency
  queues: {
    matching: { concurrency: IS_PROD ? 50 : 5 },
    notifications: { concurrency: IS_PROD ? 100 : 10 },
    payments: { concurrency: IS_PROD ? 20 : 2 },
  },

  // Global Rate Limiting
  rateLimits: {
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: IS_PROD ? 2000 : 500, // requests per window
    },
  },
};
