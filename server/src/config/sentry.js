'use strict';
// ══════════════════════════════════════════════════════════════════════════════
// config/sentry.js
// ══════════════════════════════════════════════════════════════════════════════
const Sentry = require('@sentry/node');

function init() {
  if (!process.env.SENTRY_DSN || process.env.SENTRY_DSN.includes('examplePublicKey')) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true }),
      new Sentry.Integrations.Mongo({ useMongoose: true }),
    ],
  });
}

function initRequestHandler(app) {
  if (!process.env.SENTRY_DSN || process.env.SENTRY_DSN.includes('examplePublicKey')) return;
  init();
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

function initErrorHandler(app) {
  if (!process.env.SENTRY_DSN || process.env.SENTRY_DSN.includes('examplePublicKey')) return;
  app.use(Sentry.Handlers.errorHandler());
}

function captureException(err) {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
}

module.exports = { initRequestHandler, initErrorHandler, captureException };
