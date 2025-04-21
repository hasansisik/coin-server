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
      
      // Tüm eksik coinler için yeniden dene (ancak önceden 20 ile sınırlıydı)
      const retryLimit = Math.min(100, missingSupplyCoins.length); // 100'e kadar coin için yeniden dene
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
    
    // İkinci bir kontrol ile hala eksik olan coinleri tekrar dene
    if (uniqueCoins.size < 480) { // Beklenen 500'ün altındaysa
      console.log(`Still missing coins. Only have ${uniqueCoins.size} of expected 500. Trying more coins...`);
      
      // Henüz denenmemiş coinler için ek sayfalar al
      for (let page = 6; page <= 8; page++) { // 6, 7, 8. sayfaları dene
        try {
          console.log(`Fetching additional market data page ${page}...`);
          const marketData = await getMarketData(page);
          
          for (const coin of marketData) {
            const symbol = symbolMapping[coin.id] || coin.symbol.toUpperCase();
            
            if (!uniqueCoins.has(symbol) && coin.circulating_supply && coin.circulating_supply > 0) {
              uniqueCoins.set(symbol, coin.circulating_supply);
              console.log(`Added ${symbol} from additional page ${page}`);
            }
          }
          
          // Rate limit sorunlarını önlemek için istekler arasında bekleme
          console.log(`Waiting 15 seconds before next request...`);
          await new Promise(resolve => setTimeout(resolve, 15000));
        } catch (error) {
          console.error(`Failed to fetch additional page ${page}:`, error.message);
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
    let newRecords = 0;
    let updatedRecords = 0;

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
          newRecords++;
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
          newRecords++;
        }
      } else {
        // Bugün için zaten kayıt varsa güncelle
        bulkOps.push({
          updateOne: {
            filter: { 
              symbol, 
              'dailySupplies.timestamp': {
                $gte: today,
                $lt: tomorrow
              }
            },
            update: {
              $set: {
                'dailySupplies.$.circulatingSupply': circulatingSupply,
                'dailySupplies.$.timestamp': new Date()
              }
            }
          }
        });
        updatedRecords++;
      }
    }

    if (bulkOps.length > 0) {
      const result = await SupplyHistory.bulkWrite(bulkOps);
      console.log(`Successfully updated/added supply data for ${bulkOps.length} coins (New: ${newRecords}, Updated: ${updatedRecords})`);
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

    // Get the existing supply history
    const allSupplyHistories = await SupplyHistory.find({});
    const supplyHistoryMap = {};
    
    // Son 30 günlük tarih aralığını hesapla
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Supply geçmişini sembol bazında düzenle
    allSupplyHistories.forEach(history => {
      // Tarihe göre sırala (son 30 gün)
      const filteredSupplies = history.dailySupplies
        .filter(supply => new Date(supply.timestamp) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      supplyHistoryMap[history.symbol] = filteredSupplies;
    });

    console.log(`Found supply history for ${Object.keys(supplyHistoryMap).length} coins`);
    
    // Get the latest coin data record or create a new one if none exists
    let coinData = await CoinData.findOne().sort({ date: -1 });
    
    // Check if we have a record for today
    const isTodayRecord = coinData && (new Date(coinData.date).toDateString() === today.toDateString());
    
    // If no existing data or not from today, create a new record
    if (!coinData || !isTodayRecord) {
      coinData = new CoinData({
        date: new Date(),
        coins: []
      });
      console.log("Creating new coin data record for today");
    } else {
      console.log("Updating existing coin data record for today");
    }
    
    // Process coins and add supply history
    let processedCoins = allCoins.map((coin, index) => {
      const symbol = coin.symbol.toUpperCase();
      const supplies = supplyHistoryMap[symbol] || [];
      
      // Current supply is from the API
      const currentSupply = coin.circulating_supply || 0;
      
      // Skip coins with zero supply
      if (currentSupply <= 0) {
        return null;
      }
      
      // Bugünün tarih bilgisi
      const today = new Date();
      const todayStr = today.toDateString();
      
      // Mevcut supplies dizisini al
      let allSupplies = [];
      
      // Eğer bu coin'in mevcut kaydı varsa, onu bul
      let existingCoin = null;
      if (isTodayRecord && coinData.coins) {
        existingCoin = coinData.coins.find(c => c.symbol === symbol);
      }
      
      if (existingCoin && existingCoin.supplies) {
        allSupplies = [...existingCoin.supplies];
        
        // Bugün için kayıt var mı kontrol et
        const todaySupplyIndex = allSupplies.findIndex(s => 
          new Date(s.timestamp).toDateString() === todayStr
        );
        
        if (todaySupplyIndex >= 0) {
          // Bugün için zaten kayıt varsa, onu güncelle
          console.log(`Updating today's supply record for ${symbol}`);
          allSupplies[todaySupplyIndex].value = currentSupply;
          allSupplies[todaySupplyIndex].timestamp = today;
        } else {
          // Bugün için kayıt yoksa, yeni ekle
          console.log(`Adding new supply record for ${symbol}`);
          allSupplies.push({
            value: currentSupply,
            timestamp: today
          });
        }
      } else {
        // Hiç supply kaydı yoksa, bugünü ekle
        allSupplies.push({
          value: currentSupply,
          timestamp: today
        });
        
        // SupplyHistory'den alınan geçmiş değerleri ekle
        if (supplies.length > 0) {
          // Her bir supply için yeni format oluştur ve ekle
          supplies.forEach(supply => {
            allSupplies.push({
              value: supply.circulatingSupply,
              timestamp: supply.timestamp
            });
          });
        }
      }
      
      // Tekrarlayan kayıtları filtrele - aynı gün için en son değer kalsın
      const uniqueSupplies = [];
      const seenDates = new Set();
      
      // Zaman damgasına göre sırala (en yeni en önce)
      allSupplies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      for (const supply of allSupplies) {
        const dateStr = new Date(supply.timestamp).toDateString();
        if (!seenDates.has(dateStr)) {
          uniqueSupplies.push(supply);
          seenDates.add(dateStr);
        }
      }

      // Debug output for specific coins of interest
      if (symbol === 'BNB' || symbol === 'BTC' || symbol === 'ETH') {
        console.log(`Supply data for ${symbol}:`, {
          current: currentSupply,
          supplyHistoryCount: supplies.length,
          suppliesAdded: uniqueSupplies.length
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
        supplies: uniqueSupplies
      };
    });
    
    // Null değerlerini filtrele (0 supply olan coinler)
    processedCoins = processedCoins.filter(coin => coin !== null);
    
    // Sıralamayı güncelle
    processedCoins.forEach((coin, index) => {
      coin.rank = index + 1;
    });

    // If updating existing record, replace the coins array
    if (isTodayRecord) {
      coinData.coins = processedCoins;
      coinData.updatedAt = new Date();
    } else {
      // New record with the processed coins
      coinData.coins = processedCoins;
    }
    
    // Save the data
    await coinData.save();

    console.log(`Successfully ${isTodayRecord ? 'updated' : 'saved'} complete data for ${processedCoins.length} coins`);
    return {
      success: true,
      message: `${isTodayRecord ? 'Updated' : 'Saved'} complete coin data for ${processedCoins.length} coins`
    };
  } catch (error) {
    console.error('Error saving daily coin data:', error);
    throw error;
  }
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
