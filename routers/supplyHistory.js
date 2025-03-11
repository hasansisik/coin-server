const express = require("express");
const { 
  saveSupplyHistory, 
  getSupplyHistory,
  getLatestSupplyHistory
} = require("../controllers/supplyHistory");
const { isAuthenticated } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", isAuthenticated, saveSupplyHistory);
router.get("/", isAuthenticated, getSupplyHistory);
router.get("/latest", isAuthenticated, getLatestSupplyHistory);

module.exports = router;
