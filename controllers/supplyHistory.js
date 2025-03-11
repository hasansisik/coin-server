const SupplyHistory = require("../models/SupplyHistory");
const { StatusCodes } = require("http-status-codes");
const axios = require('axios');

const getTimeframeInMS = (period) => {
  switch(period) {
    case '1w': return 7 * 24 * 60 * 60 * 1000;    // 1 hafta
    case '1m': return 30 * 24 * 60 * 60 * 1000;   // 1 ay
    case '1y': return 365 * 24 * 60 * 60 * 1000;  // 1 yıl
    default: return 7 * 24 * 60 * 60 * 1000;      // varsayılan 1 hafta
  }
};

const saveSupplyHistory = async (req, res) => {
  try {
    const { symbol, totalSupply, period } = req.body;
    
    if (!['1w', '1m', '1y'].includes(period)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Geçersiz periyod. Kullanılabilir periyodlar: 1w, 1m, 1y"
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
  try {
    const { symbol, period } = req.query;
    
    if (!['1w', '1m', '1y'].includes(period)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Geçersiz periyod. Kullanılabilir periyodlar: 1w, 1m, 1y"
      });
    }

    const timeframe = getTimeframeInMS(period);
    const history = await SupplyHistory.find({ 
      symbol,
      period,
      timestamp: { 
        $gte: new Date(Date.now() - timeframe)
      }
    }).sort({ timestamp: -1 });

    res.status(StatusCodes.OK).json({
      success: true,
      history
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Supply history alınırken hata oluştu",
      error: error.message
    });
  }
};

const getLatestSupplyHistory = async (req, res) => {
  try {
    const { symbol } = req.query;
    
    const latestHistory = {};
    for (const period of ['1w', '1m', '1y']) {
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

const saveCurrentSupplies = async () => {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        order: 'market_cap_desc',
        per_page: 250,
        sparkline: false
      }
    });

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('Invalid response from CoinGecko API');
    }

    const coins = response.data;
    console.log('Current supplies fetched:', coins.length);
    const now = new Date();

    for (const coin of coins) {
      if (!coin.symbol) continue;
      
      // Mevcut supply'ı tüm periyodlar için ayrı kaydet
      await Promise.all(['1w', '1m', '1y'].map(async (period) => {
        try {
          const existingRecord = await SupplyHistory.findOne({
            symbol: coin.symbol.toUpperCase(),
            period,
            timestamp: {
              $gte: new Date(now.getTime() - getTimeframeInMS(period))
            }
          });

          if (!existingRecord) {
            await SupplyHistory.create({
              symbol: coin.symbol.toUpperCase(),
              totalSupply: coin.total_supply ?? 0,
              period,
              timestamp: now
            });
            console.log(`Saved ${period} supply for ${coin.symbol}`);
          }
        } catch (err) {
          console.error(`Error saving ${period} supply for ${coin.symbol}:`, err);
        }
      }));
    }

    return true;
  } catch (error) {
    console.error('Error in saveCurrentSupplies:', error);
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
