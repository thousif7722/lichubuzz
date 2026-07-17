'use strict';

const axios = require('axios');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const MSG91_BASE_URL = process.env.MSG91_BASE_URL || 'https://control.msg91.com/api/v5';
const MSG91_TIMEOUT_MS = parseInt(process.env.MSG91_TIMEOUT_MS || '10000', 10);
const DEFAULT_OTP_LENGTH = parseInt(process.env.MSG91_OTP_LENGTH || '6', 10);
const DEFAULT_OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
const DEV_OTP = process.env.DEV_OTP || '123456';

function isDevelopment() {
  return process.env.NODE_ENV === 'development';
}

function normalizeMobile(phone) {
  const digits = String(phone || '').replace(/\D/g, '');

  if (/^[6-9]\d{9}$/.test(digits)) {
    return `91${digits}`;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  throw new AppError('Enter a valid Indian mobile number', 400);
}

function requireMsg91Config(keys) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new AppError(`MSG91 is not configured: missing ${missing.join(', ')}`, 503);
  }
}

function getResponseMessage(data, fallback) {
  if (!data) return fallback;
  if (typeof data === 'string') return data;
  return data.message || data.error || fallback;
}

function assertMsg91SendSuccess(data) {
  const type = String(data?.type || '').toLowerCase();
  if (type && type !== 'success') {
    throw new AppError(getResponseMessage(data, 'MSG91 request failed'), 502);
  }
}

function assertMsg91VerifySuccess(data) {
  const type = String(data?.type || '').toLowerCase();
  const message = String(data?.message || '').toLowerCase();

  if (type === 'success') return;
  if (message.includes('verified') && !message.includes('not')) return;

  throw new AppError(getResponseMessage(data, 'Invalid OTP. Please try again.'), 400);
}

async function sendOTP(phone) {
  const mobile = normalizeMobile(phone);

  if (isDevelopment()) {
    logger.debug(`[DEV SMS] To: ${mobile} | OTP: ${DEV_OTP}`);
    return { type: 'success', message: 'DEV_OTP_LOGGED' };
  }

  requireMsg91Config(['MSG91_AUTH_KEY', 'MSG91_OTP_TEMPLATE_ID']);

  try {
    const { data } = await axios.post(
      `${MSG91_BASE_URL}/otp`,
      {},
      {
        params: {
          template_id: process.env.MSG91_OTP_TEMPLATE_ID,
          mobile,
          authkey: process.env.MSG91_AUTH_KEY,
          otp_length: DEFAULT_OTP_LENGTH,
          otp_expiry: DEFAULT_OTP_EXPIRY_MINUTES,
        },
        headers: { 'Content-Type': 'application/json' },
        timeout: MSG91_TIMEOUT_MS,
      }
    );

    assertMsg91SendSuccess(data);
    logger.debug(`MSG91 OTP sent to ${mobile}`);
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('MSG91 OTP send error:', err.response?.data || err.message);
    throw new AppError('Unable to send OTP. Please try again shortly.', 502);
  }
}

async function verifyOTP(phone, otp) {
  const mobile = normalizeMobile(phone);

  if (isDevelopment() && otp === DEV_OTP) {
    return { type: 'success', message: 'DEV_OTP_VERIFIED' };
  }

  requireMsg91Config(['MSG91_AUTH_KEY']);

  try {
    const { data } = await axios.get(`${MSG91_BASE_URL}/otp/verify`, {
      params: { otp, mobile },
      headers: { authkey: process.env.MSG91_AUTH_KEY },
      timeout: MSG91_TIMEOUT_MS,
    });

    assertMsg91VerifySuccess(data);
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('MSG91 OTP verify error:', err.response?.data || err.message);
    throw new AppError('OTP verification failed. Please try again.', 400);
  }
}

async function sendFlowMessage(phone, templateId, variables) {
  const mobile = normalizeMobile(phone);

  if (isDevelopment()) {
    logger.debug(`[DEV SMS] To: ${mobile} | Template: ${templateId} | Vars: ${JSON.stringify(variables)}`);
    return { type: 'success', message: 'DEV_SMS_LOGGED' };
  }

  requireMsg91Config(['MSG91_AUTH_KEY']);

  if (!templateId) {
    logger.warn('MSG91 flow template not configured - SMS not sent');
    return null;
  }

  try {
    const { data } = await axios.post(
      `${MSG91_BASE_URL}/flow`,
      {
        template_id: templateId,
        short_url: '0',
        recipients: [{ mobiles: mobile, ...variables }],
      },
      {
        headers: {
          accept: 'application/json',
          authkey: process.env.MSG91_AUTH_KEY,
          'Content-Type': 'application/json',
        },
        timeout: MSG91_TIMEOUT_MS,
      }
    );

    assertMsg91SendSuccess(data);
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error('MSG91 SMS flow error:', err.response?.data || err.message);
    throw new AppError('Unable to send SMS. Please try again shortly.', 502);
  }
}

async function sendSMS(phone, variables = {}) {
  return sendFlowMessage(phone, process.env.MSG91_SMS_TEMPLATE_ID, variables);
}

async function sendBookingUpdate(phone, bookingNumber, statusMessage) {
  return sendFlowMessage(phone, process.env.MSG91_BOOKING_UPDATE_TEMPLATE_ID, {
    BOOKING_NUMBER: bookingNumber,
    STATUS_MESSAGE: statusMessage,
  });
}

module.exports = { sendOTP, verifyOTP, sendSMS, sendBookingUpdate };
