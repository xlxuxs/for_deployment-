/**
 * Standard success response
 * @param {Object} res - Express response object
 * @param {any} data - Payload to send
 * @param {string|null} message - Optional human-readable message
 * @param {number} statusCode - HTTP status code (default 200)
 */
const sendSuccess = (res, data, message = null, statusCode = 200) => {
  return res.status(statusCode).json({
    status: "success",
    data,
    message,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Standard error response
 * @param {Object} res - Express response object
 * @param {string} errorCode - Machine-readable code (e.g., 'VALIDATION_ERROR')
 * @param {string} message - Human-readable error message
 * @param {Object|null} details - Optional additional details (e.g., field errors)
 * @param {number} statusCode - HTTP status code (default 400)
 */
const sendError = (
  res,
  errorCode,
  message,
  details = null,
  statusCode = 400,
) => {
  const errorObj = { code: errorCode, message };
  if (details) errorObj.details = details;
  return res.status(statusCode).json({
    status: "error",
    error: errorObj,
    timestamp: new Date().toISOString(),
  });
};

// Predefined error codes for consistency
const ErrorCodes = {
  VALIDATION: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE: "DUPLICATE_ENTRY",
  RATE_LIMIT: "RATE_LIMIT_EXCEEDED",
  AI_FAILED: "AI_SERVICE_FAILED",
  INTERNAL: "INTERNAL_SERVER_ERROR",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  ACCOUNT_DISABLED: "ACCOUNT_DISABLED",
  NOT_VERIFIED: "NOT_VERIFIED",
  POLICY_NOT_ACTIVE: "POLICY_NOT_ACTIVE",
  VOTING_CLOSED: "VOTING_CLOSED",
  ALREADY_VOTED: "ALREADY_VOTED",
};

module.exports = { sendSuccess, sendError, ErrorCodes };
