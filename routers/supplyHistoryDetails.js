const express = require("express");
const { 
  getSupplyDetails,
  getCoinSupplyDetails,
  getSupplyComparisonReport
} = require("../controllers/supplyHistoryDetails");

const router = express.Router();

// Tüm coinlerin supply detaylarını getir
router.get("/all", getSupplyDetails);

// Belirli bir coinin supply detaylarını getir
router.get("/coin/:symbol", getCoinSupplyDetails);

// Tüm coinlerin supply karşılaştırma raporunu getir
router.get("/comparison", getSupplyComparisonReport);

module.exports = router; 