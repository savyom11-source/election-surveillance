// ============================================================
// EXPRESS APP — Middleware setup, routes, error handling
// ============================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./utils/errors');

const app = express();

// ---- Security headers ----
app.use(helmet());

// ---- CORS ----
app.use(cors({
  origin: env.cors.origin,
  credentials: true,
}));

// ---- Body parsing ----
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Logging ----
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

// ---- Rate limiting ----
const limiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests, please try again later.' } },
});
app.use('/api', limiter);

// ---- Routes ----
app.use('/api', routes);

// ---- Root ----
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Election Surveillance Platform API',
      version: '1.0.0',
      status: 'running',
    },
  });
});

// ---- Error handling (must be last) ----
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
