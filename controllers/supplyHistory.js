const SupplyHistory = require("../models/SupplyHistory");
const { StatusCodes } = require("http-status-codes");
const axios = require('axios');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const getMarketData = async () => {
  try {
    let allCoins = [];
    
    // Her sayfa için retry mekanizması ile veri çekme
    for (let page = 1; page <= 5; page++) {
      let retryCount = 0;
      const maxRetries = 3;
      let success = false;

      while (!success && retryCount < maxRetries) {
        try {
          console.log(`Fetching page ${page}, attempt ${retryCount + 1}...`);
          
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
          success = true;
          
          // Başarılı istekten sonra 65 saniye bekle (rate limit yenilenme süresi)
          console.log(`Page ${page} fetched successfully. Waiting for rate limit reset...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
          
        } catch (error) {
          retryCount++;
          if (error.response && error.response.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 15;
            console.log(`Rate limit hit. Waiting ${retryAfter} seconds before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          } else if (retryCount === maxRetries) {
            throw error;
          } else {
            console.log(`Error occurred, retrying in 65 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 15000));
          }
        }
      }
    }

    return allCoins;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
};

const getCoinSymbols = async () => {
  try {
    const response = await axios.get(`${COINGECKO_API}/coins/markets`, {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 250,
        sparkline: false
      }
    });

    const symbolMapping = {};
    response.data.forEach(coin => {
      symbolMapping[coin.id] = coin.symbol.toUpperCase();
    });

    return symbolMapping;
  } catch (error) {
    console.error('Error fetching coin symbols:', error);
    return {};
  }
};

const saveSupplyHistory = async (req, res) => {
  try {
    const { symbol, circulatingSupply } = req.body;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Bugün için kayıt var mı kontrol et
    const existingRecord = await SupplyHistory.findOne({
      symbol,
      'dailySupplies.timestamp': {
        $gte: today,
        $lt: tomorrow
      }
    });

    if (existingRecord) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Bu gün için zaten kayıt mevcut"
      });
    }

    // Yeni kayıt oluştur veya mevcut kayda ekle
    await SupplyHistory.updateOne(
      { symbol },
      {
        $push: {
          dailySupplies: {
            circulatingSupply,
            timestamp: new Date()
          }
        }
      },
      { upsert: true }
    );

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Supply kaydedildi"
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Supply kaydedilirken hata oluştu",
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
    console.log('Received request for symbol:', symbol);
    
    if (!symbol) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Symbol is required'
      });
    }
    
    // Uppercase olarak arama yap
    const history = await SupplyHistory.findOne({ 
      symbol: symbol.toUpperCase()
    });
    
    if (!history) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: `No supply history found for symbol: ${symbol}`
      });
    }
    
    res.status(StatusCodes.OK).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error("Error in getLatestSupplyHistory:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Supply history alınırken hata oluştu",
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Bugün için veri var mı kontrol et
    const todaysData = await SupplyHistory.findOne({
      'dailySupplies.timestamp': {
        $gte: today,
        $lt: tomorrow
      }
    });

    // Eğer bugün için veri varsa işlemi atla
    if (todaysData) {
      console.log('Today\'s data already exists, skipping...');
      return {
        success: true,
        message: 'Today\'s data already exists'
      };
    }

    const marketData = await getMarketData();
    const symbolMapping = await getCoinSymbols();
    console.log(`Processing ${marketData.length} coins from CoinGecko...`);
    
    const uniqueCoins = new Map();
    marketData
      .filter(c => c.circulating_supply)
      .forEach(coin => {
        const symbol = symbolMapping[coin.id] || coin.symbol.toUpperCase();
        if (!uniqueCoins.has(symbol)) {
          uniqueCoins.set(symbol, coin.circulating_supply);
        }
      });

    const bulkOps = [];

    for (const [symbol, circulatingSupply] of uniqueCoins) {
      // Her sembol için o günün kaydı var mı kontrol et
      const existingRecord = await SupplyHistory.findOne({
        symbol,
        'dailySupplies.timestamp': {
          $gte: today,
          $lt: tomorrow
        }
      });

      if (!existingRecord) {
        // Sembol için kayıt var mı kontrol et
        const symbolRecord = await SupplyHistory.findOne({ symbol });

        if (symbolRecord) {
          // Mevcut kayıt varsa dailySupplies'a ekle
          bulkOps.push({
            updateOne: {
              filter: { symbol },
              update: {
                $push: {
                  dailySupplies: {
                    circulatingSupply,
                    timestamp: new Date()
                  }
                }
              }
            }
          });
        } else {
          // Hiç kayıt yoksa yeni kayıt oluştur
          bulkOps.push({
            updateOne: {
              filter: { symbol },
              update: {
                $set: {
                  symbol,
                  dailySupplies: [{
                    circulatingSupply,
                    timestamp: new Date()
                  }]
                }
              },
              upsert: true
            }
          });
        }
      }
    }

    if (bulkOps.length > 0) {
      const result = await SupplyHistory.bulkWrite(bulkOps);
      console.log(`Successfully updated/added supply data for ${bulkOps.length} coins`);
      return {
        success: true,
        message: `Supply history updated. Modified ${result.modifiedCount} records.`
      };
    } else {
      console.log('No new supply data to add for today');
      return {
        success: true,
        message: 'All coins already have today\'s supply data.'
      };
    }
  } catch (error) {
    console.error('Error saving daily supply history:', error);
    throw error;
  }
};

const getBulkSupplyHistory = async (req, res) => {
  try {
    const { symbols } = req.query;
    const symbolArray = symbols.split(',').map(s => s.toUpperCase());

    const supplyHistories = await SupplyHistory.find({
      symbol: { $in: symbolArray }
    });

    // Her sembol için verileri gruplayıp düzenle
    const formattedData = {};
    supplyHistories.forEach(history => {
      // Tarih bazında gruplama yap ve en son veriyi al
      const groupedSupplies = history.dailySupplies.reduce((acc, supply) => {
        const date = new Date(supply.timestamp).toISOString().split('T')[0];
        
        // Her gün için sadece bir veri al
        if (!acc[date] || new Date(supply.timestamp) > new Date(acc[date].timestamp)) {
          acc[date] = supply;
        }
        return acc;
      }, {});

      // Gruplanmış verileri array'e çevir
      const sortedSupplies = Object.values(groupedSupplies)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      formattedData[history.symbol] = {
        dailySupplies: sortedSupplies
      };
    });

    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    console.error("Error in getBulkSupplyHistory:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
};

module.exports = {
  saveSupplyHistory,
  getSupplyHistory,
  getLatestSupplyHistory,
  saveCurrentSupplies,
  getBulkSupplyHistory
};
