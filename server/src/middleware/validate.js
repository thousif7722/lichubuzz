'use strict';
const { ValidationError } = require('../utils/errors');

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false,
    });

    if (error) {
      const fields = error.details.reduce((acc, detail) => {
        acc[detail.path.join('.')] = detail.message;
        return acc;
      }, {});
      return next(new ValidationError('Validation failed', fields));
    }

    req.body = value;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const fields = error.details.reduce((acc, detail) => {
        acc[detail.path.join('.')] = detail.message;
        return acc;
      }, {});
      return next(new ValidationError('Invalid query parameters', fields));
    }

    req.query = value;
    next();
  };
}

function validateParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, { abortEarly: false });
    if (error) {
      return next(new ValidationError('Invalid URL parameters'));
    }
    req.params = value;
    next();
  };
}

module.exports = { validateBody, validateQuery, validateParams };
