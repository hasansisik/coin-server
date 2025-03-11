const mongoose = require("mongoose");

const SupplyHistorySchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  totalSupply: {
    type: Number,
    required: true
  },
  period: {
    type: String,
    enum: ['1w', '1m', '1y'],
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Composite index for efficient queries
SupplyHistorySchema.index({ symbol: 1, period: 1, timestamp: -1 });

module.exports = mongoose.model("SupplyHistory", SupplyHistorySchema);
