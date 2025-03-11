const mongoose = require("mongoose");

const SupplyHistorySchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  dailySupplies: [{
    circulatingSupply: {
      type: Number,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
});

SupplyHistorySchema.index({ symbol: 1, "dailySupplies.timestamp": -1 });

module.exports = mongoose.model("SupplyHistory", SupplyHistorySchema);
