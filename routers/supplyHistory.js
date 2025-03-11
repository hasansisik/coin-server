const express = require("express");
const { 
  saveSupplyHistory, 
  getSupplyHistory,
  getLatestSupplyHistory
} = require("../controllers/supplyHistory");

const router = express.Router();

// Authentication middleware'i kaldırıyoruz
router.post("/", saveSupplyHistory);
router.get("/", getSupplyHistory);
router.get("/latest", getLatestSupplyHistory);

module.exports = router;
