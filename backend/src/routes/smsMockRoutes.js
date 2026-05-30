const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const smsMockController = require("../controllers/smsMockController");

router.post("/simulate", smsMockController.simulateSms);
router.get("/history", smsMockController.getSmsHistory);
router.post("/reset", auth(["admin"]), smsMockController.resetPhoneState);

module.exports = router;
