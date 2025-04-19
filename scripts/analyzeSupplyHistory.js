require('dotenv').config();
const mongoose = require('mongoose');
const SupplyHistory = require('../models/SupplyHistory');

async function analyzeSupplyHistory() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');
    
    // Tarihçesi olan toplam coin sayısı
    const totalCoins = await SupplyHistory.countDocuments();
    console.log(`Total coins with supply history: ${totalCoins}`);
    
    // Tek supply kaydı olan coinler (değişim hesaplanamaz)
    const coinsWithSingleSupply = await SupplyHistory.aggregate([
      { $project: { symbol: 1, count: { $size: '$dailySupplies' } } },
      { $match: { count: 1 } },
      { $count: 'total' }
    ]);
    
    console.log(`Coins with only one supply record: ${coinsWithSingleSupply[0]?.total || 0}`);
    
    // 2 veya daha fazla kaydı olan coinler (değişim hesaplanabilir)
    const coinsWithMultipleSupplies = await SupplyHistory.aggregate([
      { $project: { symbol: 1, count: { $size: '$dailySupplies' } } },
      { $match: { count: { $gt: 1 } } },
      { $count: 'total' }
    ]);
    
    console.log(`Coins with multiple supply records: ${coinsWithMultipleSupplies[0]?.total || 0}`);
    
    // Örnek bazı coinlerin kayıt sayılarını göster
    const sampleCoins = await SupplyHistory.aggregate([
      { $project: { symbol: 1, count: { $size: '$dailySupplies' } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    console.log('\nTop 10 coins with most records:');
    sampleCoins.forEach(coin => {
      console.log(`${coin.symbol}: ${coin.count} records`);
    });
    
    // En az kayda sahip coinler
    const fewestRecords = await SupplyHistory.aggregate([
      { $project: { symbol: 1, count: { $size: '$dailySupplies' } } },
      { $sort: { count: 1 } },
      { $limit: 10 }
    ]);
    
    console.log('\nCoins with fewest records:');
    fewestRecords.forEach(coin => {
      console.log(`${coin.symbol}: ${coin.count} records`);
    });
    
    // Popüler coinlerin kayıt sayıları
    const popularCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE'];
    const popularCoinsData = await SupplyHistory.aggregate([
      { $match: { symbol: { $in: popularCoins } } },
      { $project: { symbol: 1, count: { $size: '$dailySupplies' } } },
      { $sort: { symbol: 1 } }
    ]);
    
    console.log('\nPopular coins with their record counts:');
    popularCoinsData.forEach(coin => {
      console.log(`${coin.symbol}: ${coin.count} records`);
    });
    
    // Bugün eklenen coinlerin sayısı
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todaysCoins = await SupplyHistory.countDocuments({
      'dailySupplies.timestamp': {
        $gte: today,
        $lt: tomorrow
      }
    });
    
    console.log(`\nCoins with data added today: ${todaysCoins}`);
    
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

analyzeSupplyHistory(); 