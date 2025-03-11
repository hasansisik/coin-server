const SupplyHistory = require("../models/SupplyHistory");
const { StatusCodes } = require("http-status-codes");
const axios = require('axios');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const getMarketData = async () => {
  try {
    let allCoins = [];
    
    // 5 sayfa veri çek (her sayfada 100 coin)
    for (let page = 1; page <= 5; page++) {
      console.log(`Fetching page ${page}...`);
      
      const response = await axios.get(`${COINGECKO_API}/coins/markets`, {
        params: {
          vs_currency: 'usd',
          order: 'market_cap_desc',
          per_page: 100,
          page: page,
          sparkline: false
        }
      });
      
      allCoins = [...allCoins, ...response.data];
      
      // Rate limit'e takılmamak için bekle
      if (page < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Total coins fetched: ${allCoins.length}`);
    return allCoins;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
};

const saveSupplyHistory = async (req, res) => {
  try {
    const { symbol, totalSupply, period } = req.body;
    
    if (!['1d', '1w', '1m', '1y'].includes(period)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Geçersiz periyod. Kullanılabilir periyodlar: 1d, 1w, 1m, 1y"
      });
    }

    const history = new SupplyHistory({
      symbol,
      totalSupply,
      period
    });

    await history.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      history
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Supply history kaydedilirken hata oluştu",
      error: error.message
    });
  }
};

const getSupplyHistory = async (req, res) => {
  const { symbol, startDate, endDate } = req.query;
  
  const query = { symbol };
  if (startDate || endDate) {
    query['dailySupplies.timestamp'] = {};
    if (startDate) query['dailySupplies.timestamp'].$gte = new Date(startDate);
    if (endDate) query['dailySupplies.timestamp'].$lte = new Date(endDate);
  }

  const history = await SupplyHistory.findOne(query);
  
  if (!history) {
    return { success: false, message: 'No supply history found' };
  }

  return {
    success: true,
    data: history
  };
};

const getLatestSupplyHistory = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    const latestHistory = {};
    for (const period of ['1d', '1w', '1m', '1y']) {
      const latest = await SupplyHistory.findOne({ 
        symbol,
        period
      }).sort({ timestamp: -1 });
      
      if (latest) {
        latestHistory[period] = latest;
      }
    }
    
    res.status(StatusCodes.OK).json({
      success: true,
      history: latestHistory
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "En son supply history alınırken hata oluştu",
      error: error.message
    });
  }
};

const checkDailyData = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingData = await SupplyHistory.findOne({
    'dailySupplies.timestamp': {
      $gte: today,
      $lt: tomorrow
    }
  });

  return !!existingData;
};

const saveCurrentSupplies = async () => {
  try {
    const hasDataForToday = await checkDailyData();
    
    if (hasDataForToday) {
      console.log('Data already exists for today, skipping...');
      return { success: true, message: 'Data already exists for today' };
    }

    const marketData = await getMarketData();
    console.log(`Processing ${marketData.length} coins from CoinGecko...`);
    
    const bulkOps = marketData
      .filter(coin => coin.total_supply !== null && coin.total_supply !== undefined)
      .map(coin => ({
        updateOne: {
          filter: { symbol: coin.id },
          update: { 
            $push: { 
              dailySupplies: {
                totalSupply: coin.total_supply || coin.circulating_supply || 0,
                timestamp: new Date()
              }
            }
          },
          upsert: true
        }
      }));

    if (bulkOps.length > 0) {
      await SupplyHistory.bulkWrite(bulkOps);
      console.log(`Successfully processed ${bulkOps.length} coins`);
    }

    return { success: true, message: `Daily supply history updated successfully for ${bulkOps.length} coins` };
  } catch (error) {
    console.error('Error saving daily supply history:', error);
    throw error;
  }
};
// setInterval kaldırıldı çünkü cron job kullanıyoruz

module.exports = {
  saveSupplyHistory,
  getSupplyHistory,
  getLatestSupplyHistory,
  saveCurrentSupplies
};
