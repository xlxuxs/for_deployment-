const express = require("express");
const router = express.Router();
const publicController = require("../controllers/publicController");

router.get("/landing", publicController.getLandingData);
router.get("/policy/:id/analytics", publicController.getPolicyAnalytics);
router.get("/policy/:id/comments", publicController.getPolicyComments);

module.exports = router;