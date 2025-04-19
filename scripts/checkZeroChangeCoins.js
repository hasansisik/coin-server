require('dotenv').config();
const mongoose = require('mongoose');
const CoinData = require('../models/CoinData');
const SupplyHistory = require('../models/SupplyHistory');

async function checkZeroChangeCoins() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');
    
    // En son coin verilerini al
    const latestCoinData = await CoinData.findOne().sort({ date: -1 });
    
    if (!latestCoinData) {
      console.log('No coin data found!');
      process.exit(0);
    }
    
    // Supply değişimi 0 olan coinleri filtrele
    const zeroChangeCoins = latestCoinData.coins.filter(coin => 
      coin.supplyChange1d && coin.supplyChange1d.change === 0
    );
    
    console.log(`Found ${zeroChangeCoins.length} coins with zero daily supply change`);
    
    // İlk 10 tanesini göster
    console.log('\nFirst 10 coins with zero daily supply change:');
    for (let i = 0; i < Math.min(10, zeroChangeCoins.length); i++) {
      const coin = zeroChangeCoins[i];
      console.log(`${coin.symbol} (Rank ${coin.rank}): Current supply = ${coin.circulatingSupply}`);
      console.log(`  Supply Change 1d: ${JSON.stringify(coin.supplyChange1d)}`);
    }
    
    // SupplyHistory'den bu coinlerin tüm kayıtlarını kontrol et
    // İlk 5 tanesini detaylı incele
    console.log('\nDetailed supply history for first 5 zero-change coins:');
    for (let i = 0; i < Math.min(5, zeroChangeCoins.length); i++) {
      const coin = zeroChangeCoins[i];
      const history = await SupplyHistory.findOne({ symbol: coin.symbol });
      
      if (history) {
        const recordCount = history.dailySupplies.length;
        console.log(`${coin.symbol}: ${recordCount} supply records`);
        
        // Son 3 kaydı göster (varsa)
        const sortedSupplies = [...history.dailySupplies].sort(
          (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        console.log('  Last records:');
        for (let j = 0; j < Math.min(3, sortedSupplies.length); j++) {
          const record = sortedSupplies[j];
          console.log(`   ${new Date(record.timestamp).toISOString().split('T')[0]}: ${record.circulatingSupply}`);
        }
      } else {
        console.log(`${coin.symbol}: No supply history found!`);
      }
      console.log('---');
    }
    
    // Tarihsel kayıt sayısına göre değişim değeri 0 olan coinleri gruplayalım
    console.log('\nZero-change coins grouped by record count:');
    
    let singleRecord = 0;
    let twoRecords = 0;
    let multipleRecords = 0;
    
    for (const coin of zeroChangeCoins) {
      const history = await SupplyHistory.findOne({ symbol: coin.symbol });
      
      if (!history) continue;
      
      const recordCount = history.dailySupplies.length;
      
      if (recordCount === 1) {
        singleRecord++;
      } else if (recordCount === 2) {
        twoRecords++;
      } else {
        multipleRecords++;
      }
    }
    
    console.log(`Coins with single record: ${singleRecord}`);
    console.log(`Coins with two records: ${twoRecords}`);
    console.log(`Coins with more than two records: ${multipleRecords}`);
    
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkZeroChangeCoins(); 