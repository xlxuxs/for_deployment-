const mongoose = require("mongoose");
const { sendError, ErrorCodes } = require("../utils/responseHelper");

const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(
        res,
        ErrorCodes.NOT_FOUND,
        "Resource not found",
        null,
        404,
      );
    }
    next();
  };
};

module.exports = validateObjectId;
