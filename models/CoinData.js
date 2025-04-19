const mongoose = require("mongoose");

const CoinDataSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  coins: [{
    rank: {
      type: Number,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true
    },
    icon: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    volume24h: {
      type: Number,
      required: true
    },
    marketCap: {
      type: Number,
      required: true
    },
    circulatingSupply: {
      type: Number,
      required: true
    },
    totalSupply: {
      type: Number,
      default: 0
    },
    maxSupply: {
      type: Number,
      default: null
    },
    supplyChange1d: {
      change: {
        type: Number,
        default: null
      },
      supply: {
        type: Number,
        default: null
      }
    },
    supplyChange1w: {
      change: {
        type: Number,
        default: null
      },
      supply: {
        type: Number,
        default: null
      }
    },
    supplyChange1m: {
      change: {
        type: Number,
        default: null
      },
      supply: {
        type: Number,
        default: null
      }
    }
  }]
}, {
  timestamps: true
});

// Index for faster queries by date
CoinDataSchema.index({ date: -1 });

module.exports = mongoose.model("CoinData", CoinDataSchema); 