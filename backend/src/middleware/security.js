const xss = require("xss");

/**
 * Recursively sanitise strings in an object using xss.
 */
const sanitizeObject = (obj) => {
  if (typeof obj === "string") {
    return xss(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === "object") {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        newObj[key] = sanitizeObject(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

/**
 * Middleware to sanitise req.body, req.query, and req.params.
 */
exports.sanitizeInput = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  next();
};

/**
 * Middleware to prevent NoSQL injection by removing keys containing $ or .
 */
exports.preventNoSqlInjection = (req, res, next) => {
  const sanitizeKeys = (obj) => {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      return obj.map(sanitizeKeys);
    }
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Remove keys that contain $ or .
        if (key.includes("$") || key.includes(".")) {
          continue;
        }
        newObj[key] = sanitizeKeys(obj[key]);
      }
    }
    return newObj;
  };
  req.body = sanitizeKeys(req.body);
  req.query = sanitizeKeys(req.query);
  req.params = sanitizeKeys(req.params);
  next();
};
