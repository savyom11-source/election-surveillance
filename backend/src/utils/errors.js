// ============================================================
// ERROR HANDLING — Custom error classes + central handler
// ============================================================

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden — insufficient permissions') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null) {
    super(message, 400);
    this.details = details;
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

// ----------------------------------------------------------
// Central error handler middleware — register LAST in app.js
// ----------------------------------------------------------
function errorHandler(err, req, res, next) {
  let { statusCode = 500, message } = err;

  // Prisma known errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = `Duplicate value for field: ${err.meta?.target?.join(', ') || 'unknown'}`;
  }
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Log unexpected errors
  if (statusCode === 500) {
    console.error('💥 Unexpected error:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: message || 'Internal server error',
      ...(err.details && { details: err.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

// ----------------------------------------------------------
// 404 handler — register before errorHandler
// ----------------------------------------------------------
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  });
}

// ----------------------------------------------------------
// Async route wrapper — catches errors in async handlers
// Usage: router.get('/x', asyncHandler(async (req, res) => {...}))
// ----------------------------------------------------------
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
