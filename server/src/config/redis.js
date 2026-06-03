'use strict';
const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;
let redisSubscriber; // Separate client for pub/sub

const REDIS_CONFIG = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Max reconnect attempts reached');
        return new Error('Max reconnect retries reached');
      }
      const delay = Math.min(retries * 100, 3000);
      logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
      return delay;
    },
    keepAlive: 5000,
  },
};

async function connectRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // Quick TCP probe — don't even try to connect if Redis isn't up
  const isReachable = await new Promise((resolve) => {
    const net = require('net');
    let url;
    try {
      url = new URL(redisUrl);
    } catch {
      return resolve(false);
    }
    const sock = new net.Socket();
    const timeout = 1000;
    sock.setTimeout(timeout);
    sock
      .once('connect', () => { sock.destroy(); resolve(true); })
      .once('error', () => { sock.destroy(); resolve(false); })
      .once('timeout', () => { sock.destroy(); resolve(false); })
      .connect(parseInt(url.port || '6379'), url.hostname || '127.0.0.1');
  });

  if (!isReachable) {
    logger.warn('⚠️  Redis not reachable — caching and real-time scaling disabled. Start Redis to enable.');
    redisClient = null;
    redisSubscriber = null;
    return null;
  }

  try {
    const clientCfg = {
      url: redisUrl,
      socket: { reconnectStrategy: (r) => (r > 3 ? false : r * 500), connectTimeout: 3000 },
    };
    redisClient = createClient(clientCfg);
    redisSubscriber = createClient(clientCfg);

    redisClient.on('error', () => {});
    redisSubscriber.on('error', () => {});
    redisClient.on('ready', () => logger.info('✅ Redis client ready'));

    await Promise.all([redisClient.connect(), redisSubscriber.connect()]);
    return redisClient;
  } catch (error) {
    logger.warn('⚠️  Redis connection failed — caching disabled.');
    try { redisClient?.quit(); } catch { /* ignore */ }
    try { redisSubscriber?.quit(); } catch { /* ignore */ }
    redisClient = null;
    redisSubscriber = null;
    return null;
  }
}

function getRedisClient() {
  if (!redisClient?.isReady) {
    // logger.warn('Redis client not ready. Returning null.'); // commented out to avoid excessive logging
    return null;
  }
  return redisClient;
}

function getRedisSubscriber() {
  if (!redisSubscriber?.isReady) {
    return null;
  }
  return redisSubscriber;
}

// ── Cache Helpers ──────────────────────────────────────────────────────────────
const cache = {
  async get(key) {
    try {
      const client = getRedisClient();
      if (!client) return null;
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('Redis GET error:', err);
      return null;
    }
  },

  async set(key, value, ttlSeconds = 300) {
    try {
      const client = getRedisClient();
      if (!client) return false;
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error('Redis SET error:', err);
      return false;
    }
  },

  async del(key) {
    try {
      const client = getRedisClient();
      if (!client) return false;
      await client.del(key);
      return true;
    } catch (err) {
      logger.error('Redis DEL error:', err);
      return false;
    }
  },

  // FIX #11: Use SCAN instead of KEYS to avoid blocking Redis under heavy load
  async delPattern(pattern) {
    try {
      const client = getRedisClient();
      if (!client) return;
      let cursor = 0;
      const keysToDelete = [];
      do {
        // SCAN iterates incrementally — safe for billions of keys
        const reply = await client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = Number(reply.cursor);
        keysToDelete.push(...reply.keys);
      } while (cursor !== 0);
      if (keysToDelete.length > 0) {
        // Delete in batches of 500 to avoid large single commands
        for (let i = 0; i < keysToDelete.length; i += 500) {
          await client.del(keysToDelete.slice(i, i + 500));
        }
      }
    } catch (err) {
      logger.error('Redis DEL pattern error:', err);
    }
  },

  async increment(key, ttlSeconds = 900) {
    try {
      const client = getRedisClient();
      if (!client) return null;
      const val = await client.incr(key);
      if (val === 1) await client.expire(key, ttlSeconds);
      return val;
    } catch (err) {
      logger.error('Redis INCR error:', err);
      return null;
    }
  },

  async hSet(key, field, value) {
    try {
      const client = getRedisClient();
      if (!client) return false;
      await client.hSet(key, field, JSON.stringify(value));
      return true;
    } catch (err) {
      logger.error('Redis HSET error:', err);
      return false;
    }
  },

  async hGet(key, field) {
    try {
      const client = getRedisClient();
      if (!client) return null;
      const data = await client.hGet(key, field);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.error('Redis HGET error:', err);
      return null;
    }
  },

  async setNX(key, value, ttlSeconds) {
    try {
      const client = getRedisClient();
      if (!client) return false;
      const result = await client.set(key, JSON.stringify(value), {
        NX: true,
        EX: ttlSeconds,
      });
      return result === 'OK';
    } catch (err) {
      logger.error('Redis SETNX error:', err);
      return false;
    }
  },
};

// ── Session Store ──────────────────────────────────────────────────────────────
const session = {
  async save(sessionId, data, ttl = 86400) {
    await cache.set(`session:${sessionId}`, data, ttl);
  },
  async get(sessionId) {
    return cache.get(`session:${sessionId}`);
  },
  async destroy(sessionId) {
    await cache.del(`session:${sessionId}`);
  },
};

module.exports = {
  connectRedis,
  getRedisClient,
  getRedisSubscriber,
  cache,
  session,
};
