'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// services/sms.service.js
// ══════════════════════════════════════════════════════════════════════════════
const logger = require('../utils/logger');

let twilioClient;
function getTwilio() {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

async function sendOTP(phone, otp) {
  const message = `Your ServiceHub OTP is: ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share with anyone.`;
  return sendSMS(`+91${phone}`, message);
}

async function sendSMS(to, body) {
  if (process.env.NODE_ENV === 'development') {
    logger.debug(`[DEV SMS] To: ${to} | Body: ${body}`);
    return { sid: 'DEV_SMS_SID' };
  }
  const client = getTwilio();
  if (!client) {
    logger.warn('Twilio not configured — SMS not sent');
    return null;
  }
  try {
    const result = await client.messages.create({
      body,
      from: process.env.TWILIO_PHONE,
      to,
    });
    logger.debug(`SMS sent: ${result.sid} to ${to}`);
    return result;
  } catch (err) {
    logger.error('Twilio SMS error:', err.message);
    throw err;
  }
}

async function sendBookingUpdate(phone, bookingNumber, statusMessage) {
  const body = `ServiceHub: Booking ${bookingNumber} - ${statusMessage}. Track at app.servicehub.in`;
  return sendSMS(`+91${phone}`, body);
}

module.exports = { sendOTP, sendSMS, sendBookingUpdate };
