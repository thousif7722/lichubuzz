'use strict';
const logger = require('../utils/logger');

// Firebase Admin SDK (optional — falls back gracefully)
let firebaseAdmin;
function getFirebase() {
  if (firebaseAdmin) return firebaseAdmin;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  try {
    const admin = require('firebase-admin');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    }
    firebaseAdmin = admin;
    return admin;
  } catch (err) {
    logger.warn('Firebase Admin not initialized:', err.message);
    return null;
  }
}

async function send(fcmToken, title, body, data = {}) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[DEV PUSH] To: ${fcmToken?.slice(0, 10)}... | ${title}: ${body}`);
    return true;
  }
  const admin = getFirebase();
  if (!admin) {
    logger.warn('Firebase not configured — push not sent');
    return false;
  }
  try {
    const result = await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      android: { priority: 'high', notification: { sound: 'default', channelId: 'servicehub_main' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    });
    logger.debug(`Push sent: ${result}`);
    return true;
  } catch (err) {
    logger.warn('Push notification failed:', err.message);
    return false;
  }
}

async function sendToMultiple(tokens, title, body, data = {}) {
  if (!tokens?.length) return;
  const admin = getFirebase();
  if (!admin) return;
  const result = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
  });
  logger.debug(`Multicast push: ${result.successCount}/${tokens.length} sent`);
  return result;
}

module.exports = { send, sendToMultiple };
