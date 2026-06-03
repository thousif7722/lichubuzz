'use strict';
const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  if (stack) log += `\n${stack}`;
  if (Object.keys(meta).length) log += `\n${JSON.stringify(meta, null, 2)}`;
  return log;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    process.env.NODE_ENV === 'production' ? json() : combine(colorize(), logFormat)
  ),
  transports: [
    new winston.transports.Console(),
    // File transports for production
    ...(process.env.NODE_ENV === 'production' ? [
      new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
        tailable: true,
      }),
      new winston.transports.File({
        filename: path.join('logs', 'combined.log'),
        maxsize: 50 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
      }),
    ] : []),
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
  ],
});

// Morgan stream for HTTP logs
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
