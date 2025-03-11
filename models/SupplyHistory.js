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
}, {
  timestamps: true
});

// Her symbol için dailySupplies içinde timestamp'e göre index
SupplyHistorySchema.index({ symbol: 1, "dailySupplies.timestamp": -1 });

module.exports = mongoose.model("SupplyHistory", SupplyHistorySchema);
