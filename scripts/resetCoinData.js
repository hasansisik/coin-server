require("dotenv").config();
const mongoose = require("mongoose");
const CoinData = require("../models/CoinData");
const connectDB = require("../config/connectDB");
const { saveDailyData } = require("../controllers/supplyHistory");

const resetCoinData = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
    
    // Delete all records in the CoinData collection
    const deleteResult = await CoinData.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} coin data records`);
    
    // Trigger the data collection process with the new format
    console.log("Triggering data collection process with new format...");
    const result = await saveDailyData();
    console.log("Data collection result:", result);
    
    console.log("Done! Coin data has been reset and regenerated with the new format.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

resetCoinData(); 