const express = require("express");
const { 
  saveSupplyHistory, 
  getSupplyHistory,
  getLatestSupplyHistory,
  getBulkSupplyHistory
} = require("../controllers/supplyHistory");

const router = express.Router();

router.post("/", saveSupplyHistory);
router.get("/", getSupplyHistory);
router.get("/latest", getLatestSupplyHistory);
router.get("/bulk", getBulkSupplyHistory);

module.exports = router;
