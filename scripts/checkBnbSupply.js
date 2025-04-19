require('dotenv').config();
const mongoose = require('mongoose');
const SupplyHistory = require('../models/SupplyHistory');

async function checkBnbSupply() {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log('Connected to MongoDB');
    
    // BNB'nin kayıtlarını al
    const bnbHistory = await SupplyHistory.findOne({ symbol: 'BNB' });
    
    if (!bnbHistory) {
      console.log('No BNB supply history found!');
      process.exit(0);
    }
    
    console.log(`Found BNB with ${bnbHistory.dailySupplies.length} supply records`);
    
    // Kayıtları tarih sırasına göre sırala
    const sortedSupplies = [...bnbHistory.dailySupplies].sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    // En son 5 kaydı göster
    console.log('\nLast 5 BNB supply records:');
    for (let i = 0; i < Math.min(5, sortedSupplies.length); i++) {
      const record = sortedSupplies[i];
      console.log(`${new Date(record.timestamp).toISOString().split('T')[0]}: ${record.circulatingSupply}`);
    }
    
    // Bugünkü kaydı bul
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayRecord = bnbHistory.dailySupplies.find(
      supply => {
        const date = new Date(supply.timestamp);
        return date >= today && date < tomorrow;
      }
    );
    
    if (todayRecord) {
      console.log(`\nToday's BNB supply: ${todayRecord.circulatingSupply}`);
    } else {
      console.log('\nNo BNB supply record for today');
    }
    
    // Son iki kaydı karşılaştır ve değişimi hesapla (eğer varsa)
    if (sortedSupplies.length >= 2) {
      const latest = sortedSupplies[0];
      const previous = sortedSupplies[1];
      
      const change = latest.circulatingSupply - previous.circulatingSupply;
      console.log(`\nChange between last two records: ${change}`);
      console.log(`Latest record: ${new Date(latest.timestamp).toISOString().split('T')[0]}: ${latest.circulatingSupply}`);
      console.log(`Previous record: ${new Date(previous.timestamp).toISOString().split('T')[0]}: ${previous.circulatingSupply}`);
    }
    
    mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkBnbSupply(); 