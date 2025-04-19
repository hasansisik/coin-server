const express = require("express");
const { 
  saveSupplyHistory, 
  getSupplyHistory,
  getLatestSupplyHistory,
  getBulkSupplyHistory,
  getCoinData,
  getCoinHistory,
  saveDailyData
} = require("../controllers/supplyHistory");

const router = express.Router();

router.post("/", saveSupplyHistory);
router.get("/", getSupplyHistory);
router.get("/latest", getLatestSupplyHistory);
router.get("/bulk", getBulkSupplyHistory);
router.get("/coins", getCoinData);
router.get("/coin-history", getCoinHistory);
router.post("/save-daily", async (req, res) => {
  try {
    const result = await saveDailyData();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error saving daily data",
      error: error.message
    });
  }
});

module.exports = router;
