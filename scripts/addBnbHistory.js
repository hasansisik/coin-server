require("dotenv").config();
const mongoose = require("mongoose");
const SupplyHistory = require("../models/SupplyHistory");
const connectDB = require("../config/connectDB");
const axios = require('axios');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// Add BNB supply history data for demonstrative purposes
const addBnbHistory = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
    
    // Get current BNB data from CoinGecko
    console.log("Fetching BNB data from CoinGecko...");
    const bnbResponse = await axios.get(`${COINGECKO_API}/coins/binancecoin`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false
      }
    });
    
    if (!bnbResponse.data || !bnbResponse.data.market_data) {
      console.error("Failed to get BNB data from CoinGecko");
      process.exit(1);
    }
    
    const currentCirculatingSupply = bnbResponse.data.market_data.circulating_supply;
    console.log(`Current BNB circulating supply: ${currentCirculatingSupply}`);
    
    // First delete all existing BNB records to start fresh
    await SupplyHistory.deleteOne({ symbol: 'BNB' });
    console.log("Deleted existing BNB records");
    
    // Create historical entries with LARGER differences
    const today = new Date();
    
    
    // Generate synthetic data with significant differences
    const daySupply = currentCirculatingSupply - 5000;
    const weekSupply = currentCirculatingSupply - 20000;
    const monthSupply = currentCirculatingSupply - 50000;
    
    // Generate dates
    const dayAgo = new Date(today);
    dayAgo.setDate(dayAgo.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);
    
    const lastYear = new Date(today);
    lastYear.setDate(lastYear.getDate() - 365);
    
    // Create new BNB history with the current and historical data
    await SupplyHistory.create({
      symbol: 'BNB',
      dailySupplies: [
        {
          circulatingSupply: currentCirculatingSupply,
          timestamp: today
        },
        {
          circulatingSupply: daySupply,
          timestamp: dayAgo
        },
        {
          circulatingSupply: weekSupply,
          timestamp: weekAgo
        },
        {
          circulatingSupply: monthSupply,
          timestamp: monthAgo
        },
        {
          circulatingSupply: monthSupply - 30000,
          timestamp: lastYear
        }
      ]
    });
      
    console.log("Created new BNB record with historical data");
    console.log(`Daily change: +${currentCirculatingSupply - daySupply}`);
    console.log(`Weekly change: +${currentCirculatingSupply - weekSupply}`);
    console.log(`Monthly change: +${currentCirculatingSupply - monthSupply}`);
    
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

addBnbHistory(); 