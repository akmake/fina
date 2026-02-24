import logger from '../utils/logger.js';

// Global error handler
export const errorHandler = (err, req, res, next) => {
  // Log error
  logger.error('API Error', {
    message: err.message,
    code: err.code,
    statusCode: err.statusCode || 500,
    method: req.method,
    path: req.path,
    userId: req.user?._id || 'anonymous',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ message: 'Invalid or missing CSRF token.' });
  }

  const statusCode = err.statusCode || 500;
  const status = err.status || 'error';
  const message = err.message || 'Something went very wrong!';

  res.status(statusCode).json({
    status,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Wrapper for async route handlers to catch errors and pass them to the global handler
export const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Request logging middleware
export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const logLevel = statusCode >= 400 ? 'warn' : 'debug';
    
    logger.log(logLevel, `${req.method} ${req.path}`, {
      statusCode,
      duration: `${duration}ms`,
      userId: req.user?._id || 'anonymous',
    });
  });

  next();
};