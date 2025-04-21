require("dotenv").config();
const mongoose = require("mongoose");
const CoinData = require("../models/CoinData");
const connectDB = require("../config/connectDB");

const checkCoins = async () => {
  try {
    await connectDB(process.env.MONGO_URL);
    console.log("Connected to MongoDB");
    
    // CoinData koleksiyonundaki belge sayısını kontrol et
    const count = await CoinData.countDocuments();
    console.log(`CoinData collection has ${count} documents`);
    
    if (count > 0) {
      // En son belgeyi ve içindeki coin sayısını kontrol et
      const latestData = await CoinData.findOne().sort({ date: -1 });
      console.log(`Latest document date: ${latestData.date}`);
      console.log(`Latest document has ${latestData.coins.length} coins`);
      
      // Birkaç coin'in supply geçmişi hakkında bilgi ver
      if (latestData.coins.length > 0) {
        const btc = latestData.coins.find(c => c.symbol === "BTC");
        const eth = latestData.coins.find(c => c.symbol === "ETH");
        
        if (btc) {
          console.log(`BTC has ${btc.supplies.length} supply records`);
        }
        
        if (eth) {
          console.log(`ETH has ${eth.supplies.length} supply records`);
        }
      }
    }
    
    mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

checkCoins(); 