const SupplyHistory = require("../models/SupplyHistory");
const CoinData = require("../models/CoinData");
const { StatusCodes } = require("http-status-codes");
const axios = require('axios');

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

const getMarketData = async (page = 1) => {
  try {
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;
    let coinsData = [];

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
        
        coinsData = response.data;
        success = true;
        
        // Başarılı istekten sonra 15 saniye bekle (rate limit yenilenme süresi)
        console.log(`Page ${page} fetched successfully. Found ${coinsData.length} coins.`);
        
      } catch (error) {
        retryCount++;
        if (error.response && error.response.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 15;
          console.log(`Rate limit hit. Waiting ${retryAfter} seconds before retry...`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        } else if (retryCount === maxRetries) {
          throw error;
        } else {
          console.log(`Error occurred, retrying in 15 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      }
    }

    return coinsData;
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
      console.log('Today\'s data already exists, skipping supply data collection...');
      return {
        success: true,
        message: 'Today\'s data already exists'
      };
    }

    // İlk 500 coin için veri topla (5 sayfa * 100 coin)
    let allMarketData = [];
    let maxPages = 5; // 500 coins
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        console.log(`Fetching market data page ${page}/${maxPages}...`);
        const marketData = await getMarketData(page);
        allMarketData = [...allMarketData, ...marketData];
        
        // Rate limit sorunlarını önlemek için istekler arasında bekleme
        if (page < maxPages) {
          console.log(`Waiting 15 seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      } catch (error) {
        console.error(`Failed to fetch page ${page}:`, error.message);
        // Bu sayfa başarısız olsa bile diğer sayfalarla devam et
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`Total coins fetched: ${allMarketData.length}`);
    
    // Symbol eşleştirme için coin ID'lerini al
    const symbolMapping = await getCoinSymbols();
    console.log(`Processing ${allMarketData.length} coins from CoinGecko...`);
    
    // Supply verisi olmayan coinleri takip et
    const missingSupplyCoins = [];
    
    // Coin verilerini işle ve supply'ı olmayan coinleri belirle
    const uniqueCoins = new Map();
    allMarketData.forEach(coin => {
      const symbol = symbolMapping[coin.id] || coin.symbol.toUpperCase();
      
      // Sadece geçerli bir supply değeri olan coinleri ekle
      if (coin.circulating_supply && coin.circulating_supply > 0) {
        if (!uniqueCoins.has(symbol)) {
          uniqueCoins.set(symbol, coin.circulating_supply);
        }
      } else {
        // Supply değeri olmayan veya 0 olan coinleri takip et
        if (!uniqueCoins.has(symbol) && !missingSupplyCoins.includes(coin.id)) {
          missingSupplyCoins.push(coin.id);
        }
      }
    });

    // Supply eksik olan coinler için detaylı veri çekmeyi dene
    if (missingSupplyCoins.length > 0) {
      console.log(`Found ${missingSupplyCoins.length} coins missing valid supply data`);
      
      // Rate limit aşımını önlemek için sınırlı sayıda coin için yeniden dene
      const retryLimit = 20; // Daha fazla coin için yeniden dene
      const coinsToRetry = missingSupplyCoins.slice(0, retryLimit);
      
      console.log(`Attempting to fetch detailed data for ${coinsToRetry.length} coins...`);
      
      for (const coinId of coinsToRetry) {
        try {
          console.log(`Fetching detailed data for ${coinId}...`);
          
          const response = await axios.get(`${COINGECKO_API}/coins/${coinId}`, {
            params: {
              localization: false,
              tickers: false,
              market_data: true,
              community_data: false,
              developer_data: false
            }
          });
          
          if (response.data && 
              response.data.market_data && 
              response.data.market_data.circulating_supply &&
              response.data.market_data.circulating_supply > 0) {
            
            const symbol = response.data.symbol.toUpperCase();
            const supply = response.data.market_data.circulating_supply;
            
            console.log(`Retrieved supply for ${symbol}: ${supply}`);
            uniqueCoins.set(symbol, supply);
          } else {
            console.log(`No valid supply data found for ${coinId}`);
          }
          
          // Rate limit aşımını önlemek için istekler arasında bekleme
          await new Promise(resolve => setTimeout(resolve, 10000));
          
        } catch (error) {
          console.error(`Failed to fetch detailed data for ${coinId}:`, error.message);
          // Bu coin başarısız olsa bile diğerleriyle devam et
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
    }
    
    // Önemli coinler için özel kontrol (örn. BNB)
    const importantCoins = ['BNB', 'BTC', 'ETH', 'SOL', 'XRP'];
    for (const symbol of importantCoins) {
      if (!uniqueCoins.has(symbol)) {
        try {
          // Coin ID'sini bul
          let coinId = "";
          for (const [id, sym] of Object.entries(symbolMapping)) {
            if (sym === symbol) {
              coinId = id;
              break;
            }
          }
          
          if (!coinId) {
            switch(symbol) {
              case 'BTC': coinId = 'bitcoin'; break;
              case 'ETH': coinId = 'ethereum'; break;
              case 'BNB': coinId = 'binancecoin'; break;
              case 'SOL': coinId = 'solana'; break;
              case 'XRP': coinId = 'ripple'; break;
              default: coinId = symbol.toLowerCase();
            }
          }
          
          console.log(`Specifically fetching data for important coin ${symbol} (ID: ${coinId})...`);
          
          const response = await axios.get(`${COINGECKO_API}/coins/${coinId}`, {
            params: {
              localization: false,
              tickers: false,
              market_data: true,
              community_data: false,
              developer_data: false
            }
          });
          
          if (response.data && 
              response.data.market_data && 
              response.data.market_data.circulating_supply &&
              response.data.market_data.circulating_supply > 0) {
            
            const supply = response.data.market_data.circulating_supply;
            console.log(`Retrieved ${symbol} supply: ${supply}`);
            uniqueCoins.set(symbol, supply);
          }
          
          // Rate limit aşımını önlemek için istekler arasında bekleme
          await new Promise(resolve => setTimeout(resolve, 10000));
          
        } catch (error) {
          console.error(`Failed to fetch ${symbol} data:`, error.message);
        }
      }
    }

    console.log(`Found ${uniqueCoins.size} unique coins with valid supply data`);
    
    // En son 7 günlük tüm kayıtları al, bugün olmayanları eklemek için
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    
    const recentHistory = await SupplyHistory.find({
      'dailySupplies.timestamp': {
        $gte: lastWeek
      }
    });
    
    // Son hafta içinde kayıt olan ama bugün için henüz eklenmemiş coinleri belirle
    const recentCoins = new Set();
    recentHistory.forEach(history => {
      recentCoins.add(history.symbol);
    });
    
    console.log(`Found ${recentCoins.size} coins with recent history`);

    const bulkOps = [];

    // Bugünün verileri için toplu işlemi hazırla
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

const saveDailyCoinData = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Check if we already have data for today
    const existingData = await CoinData.findOne({ date: { $gte: today } });
    if (existingData) {
      console.log('Coin data for today already exists, skipping coin data collection...');
      return {
        success: true,
        message: 'Today\'s coin data already exists'
      };
    }

    // İlk 500 coini topla (5 sayfa)
    let allCoins = [];
    for (let page = 1; page <= 5; page++) {
      try {
        console.log(`Fetching market data page ${page}/5 for coin data...`);
        const pageCoins = await getMarketData(page);
        allCoins = [...allCoins, ...pageCoins];
        
        // Rate limiting'i önlemek için bekle
        if (page < 5) {
          await new Promise(resolve => setTimeout(resolve, 15000));
        }
      } catch (error) {
        console.error(`Error fetching page ${page}:`, error.message);
        // Hata olsa bile devam et
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    console.log(`Processing ${allCoins.length} coins for complete data storage...`);

    // Get the existing supply history to calculate changes
    const allSupplyHistories = await SupplyHistory.find({});
    const supplyHistoryMap = {};
    
    allSupplyHistories.forEach(history => {
      // Sort by timestamp descending to get latest first
      const sortedSupplies = [...history.dailySupplies]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      supplyHistoryMap[history.symbol] = sortedSupplies;
    });

    console.log(`Found supply history for ${Object.keys(supplyHistoryMap).length} coins`);
    
    // Process coins and calculate supply changes
    let processedCoins = allCoins.map((coin, index) => {
      const symbol = coin.symbol.toUpperCase();
      const supplies = supplyHistoryMap[symbol] || [];
      
      // Current supply is from the API
      const currentSupply = coin.circulating_supply || 0;
      
      // Skip coins with zero supply
      if (currentSupply <= 0) {
        return null;
      }
      
      // Calculate supply changes for different periods
      const supplyChange1d = calculateSupplyChange(supplies, currentSupply, 1);
      const supplyChange1w = calculateSupplyChange(supplies, currentSupply, 7);
      const supplyChange1m = calculateSupplyChange(supplies, currentSupply, 30);

      // Debug output for specific coins of interest
      if (symbol === 'BNB' || symbol === 'BTC' || symbol === 'ETH') {
        console.log(`Supply data for ${symbol}:`, {
          current: currentSupply,
          supplyHistoryCount: supplies.length,
          day: supplyChange1d,
          week: supplyChange1w,
          month: supplyChange1m
        });
      }

      return {
        rank: index + 1,
        name: coin.name,
        symbol: symbol,
        icon: coin.image,
        price: coin.current_price,
        volume24h: coin.total_volume,
        marketCap: coin.market_cap,
        circulatingSupply: currentSupply,
        totalSupply: coin.total_supply || coin.circulating_supply,
        maxSupply: coin.max_supply,
        supplyChange1d,
        supplyChange1w,
        supplyChange1m
      };
    });
    
    // Null değerlerini filtrele (0 supply olan coinler)
    processedCoins = processedCoins.filter(coin => coin !== null);
    
    // Sıralamayı güncelle
    processedCoins.forEach((coin, index) => {
      coin.rank = index + 1;
    });

    // Save the coin data for today
    const coinData = new CoinData({
      date: new Date(),
      coins: processedCoins
    });
    
    await coinData.save();

    console.log(`Successfully saved complete data for ${processedCoins.length} coins`);
    return {
      success: true,
      message: `Saved complete coin data for ${processedCoins.length} coins`
    };
  } catch (error) {
    console.error('Error saving daily coin data:', error);
    throw error;
  }
};

// Helper function to calculate supply change for a given period
const calculateSupplyChange = (supplies, currentSupply, days) => {
  if (!supplies || supplies.length === 0 || !currentSupply || currentSupply <= 0) {
    return { change: null, supply: null };
  }

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - days);

  // Find the supply record closest to the target date
  let closestSupply = null;
  let minTimeDiff = Infinity;

  for (const supply of supplies) {
    const supplyDate = new Date(supply.timestamp);
    const timeDiff = Math.abs(supplyDate.getTime() - targetDate.getTime());
    
    // Kabul edilebilir zaman aralığı (1 hafta)
    const maxAcceptableTimeDiff = 7 * 24 * 60 * 60 * 1000; // 7 gün
    
    // Eğer fark kabul edilebilir aralıktan fazla ise, o kaydı atlama
    if (timeDiff > maxAcceptableTimeDiff && days <= 7) {
      continue;
    }
    
    if (timeDiff < minTimeDiff) {
      minTimeDiff = timeDiff;
      closestSupply = supply;
    }
  }

  // Tarih farkı 30 günden fazlaysa ve aylık değişim hesaplanıyorsa, 
  // son kayıttan geçerli bir değişim değeri hesapla
  if (!closestSupply && days === 30 && supplies.length > 0) {
    closestSupply = supplies[0]; // En son kayıt
    
    // Günlük yaklaşık değişim hesapla
    const dailyChange = (currentSupply - closestSupply.circulatingSupply) / 
                        (Math.max(1, Math.abs(new Date().getTime() - new Date(closestSupply.timestamp).getTime()) / (24 * 60 * 60 * 1000)));
    
    // Aylık değişimi tahmin et
    const estimatedMonthlyChange = dailyChange * 30;
    const estimatedPastSupply = currentSupply - estimatedMonthlyChange;
    
    if (estimatedPastSupply > 0) {
      return {
        change: Math.round(estimatedMonthlyChange),
        supply: Math.round(estimatedPastSupply)
      };
    }
  }

  if (!closestSupply) {
    return { change: null, supply: null };
  }

  const oldSupply = closestSupply.circulatingSupply;
  
  // Eğer önceki supply değeri 0 veya geçersizse, değişimi hesaplama
  if (oldSupply <= 0) {
    return { change: null, supply: null };
  }
  
  const supplyDifference = Math.round(currentSupply - oldSupply);
  const actualDays = Math.max(1, Math.abs(new Date().getTime() - new Date(closestSupply.timestamp).getTime()) / (24 * 60 * 60 * 1000));
  
  // Log detailed information for debugging
  console.log(`Supply change for ${days} days: Current=${currentSupply}, Old=${oldSupply}, Diff=${supplyDifference}, ActualDays=${actualDays.toFixed(1)}, Date=${new Date(closestSupply.timestamp).toISOString()}`);
  
  return {
    change: supplyDifference,
    supply: oldSupply
  };
};

// Get coin data by page
const getCoinData = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    // Get the latest coin data
    const latestData = await CoinData.findOne().sort({ date: -1 });
    
    if (!latestData) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'No coin data available'
      });
    }
    
    // Calculate pagination
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = pageNum * limitNum;
    const totalCoins = latestData.coins.length;
    
    // Ensure we have at least the requested page amount of data
    if (startIndex >= totalCoins) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: `Page ${pageNum} exceeds available data. Max page: ${Math.ceil(totalCoins / limitNum)}`
      });
    }
    
    // Get the coins for the requested page
    const paginatedCoins = latestData.coins.slice(startIndex, endIndex);
    
    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        coins: paginatedCoins,
        page: pageNum,
        limit: limitNum,
        totalCoins: totalCoins,
        lastUpdated: latestData.date,
        maxPage: Math.ceil(totalCoins / limitNum)
      }
    });
  } catch (error) {
    console.error("Error in getCoinData:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error fetching coin data",
      error: error.message
    });
  }
};

// Get historical coin data for a specific coin
const getCoinHistory = async (req, res) => {
  try {
    const { symbol, days = 30 } = req.query;
    
    if (!symbol) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'Symbol is required'
      });
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Find all coin data within the date range
    const allData = await CoinData.find({
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });
    
    // Extract data for the requested coin
    const coinHistory = allData.map(dayData => {
      const coin = dayData.coins.find(c => c.symbol === symbol.toUpperCase());
      return coin ? {
        date: dayData.date,
        price: coin.price,
        volume24h: coin.volume24h,
        marketCap: coin.marketCap,
        circulatingSupply: coin.circulatingSupply
      } : null;
    }).filter(Boolean);
    
    if (coinHistory.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: `No historical data found for ${symbol}`
      });
    }
    
    return res.status(StatusCodes.OK).json({
      success: true,
      data: coinHistory
    });
  } catch (error) {
    console.error("Error in getCoinHistory:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error fetching coin history",
      error: error.message
    });
  }
};

// Daily job to save both supply history and complete coin data
const saveDailyData = async () => {
  try {
    // First save the supply history
    await saveCurrentSupplies();
    
    // Then save the complete coin data with calculated supply changes
    await saveDailyCoinData();
    
    return {
      success: true,
      message: 'Daily data saved successfully'
    };
  } catch (error) {
    console.error('Error saving daily data:', error);
    throw error;
  }
};

module.exports = {
  saveSupplyHistory,
  getSupplyHistory,
  getLatestSupplyHistory,
  saveCurrentSupplies,
  getBulkSupplyHistory,
  saveDailyCoinData,
  getCoinData,
  getCoinHistory,
  saveDailyData
};
