require('dotenv').config();
const mongoose = require('mongoose');
const SupplyHistory = require('../models/SupplyHistory');
const CoinData = require('../models/CoinData');

async function checkSingleSupplyCoins() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');
    
    // Tek supply kaydı olan coinleri bul
    const singleSupplyCoins = await SupplyHistory.aggregate([
      { $project: { symbol: 1, count: { $size: '$dailySupplies' }, dailySupplies: 1 } },
      { $match: { count: 1 } },
      { $sort: { symbol: 1 } }
    ]);
    
    console.log(`Found ${singleSupplyCoins.length} coins with only one supply record`);
    
    // En son coin verileri
    const latestCoinData = await CoinData.findOne().sort({ date: -1 });
    
    if (!latestCoinData) {
      console.log('No coin data found!');
      process.exit(0);
    }
    
    // Her bir tek kaydı olan coin için detayları göster
    console.log('\nDetails of coins with single supply record:');
    for (const coin of singleSupplyCoins) {
      const symbol = coin.symbol;
      const supply = coin.dailySupplies[0].circulatingSupply;
      const date = new Date(coin.dailySupplies[0].timestamp).toISOString().split('T')[0];
      
      // CoinData'da bu coinin verilerini bul
      const coinData = latestCoinData.coins.find(c => c.symbol === symbol);
      
      if (coinData) {
        console.log(`${symbol}: ${supply} (Recorded on ${date})`);
        console.log(`  Current supply from API: ${coinData.circulatingSupply}`);
        console.log(`  Supply change 1d: ${JSON.stringify(coinData.supplyChange1d)}`);
        console.log(`  Rank: ${coinData.rank}, Price: $${coinData.price.toFixed(2)}`);
      } else {
        console.log(`${symbol}: ${supply} (Recorded on ${date}) - Not found in current coin data`);
      }
      console.log('---');
    }
    
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSingleSupplyCoins(); 