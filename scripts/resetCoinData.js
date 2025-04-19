require("dotenv").config();
const mongoose = require("mongoose");
const CoinData = require("../models/CoinData");
const connectDB = require("../config/connectDB");

const resetCoinData = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
    
    // Delete all records in the CoinData collection
    await CoinData.deleteMany({});
    console.log("Deleted all coin data records");
    
    console.log("Done! Now run the save-daily endpoint to regenerate the data.");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

resetCoinData(); 