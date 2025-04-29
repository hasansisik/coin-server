const SupplyHistory = require("../models/SupplyHistory");
const { StatusCodes } = require("http-status-codes");

/**
 * SupplyHistory modelinden tüm coin'lerin belirli zaman dilimlerindeki supply verilerini döndürür
 */
const getSupplyDetails = async (req, res) => {
  try {
    // Tüm SupplyHistory kayıtlarını çek
    const allSupplyHistories = await SupplyHistory.find({});
    
    // Dönüş verisi için obje hazırla
    const result = {};
    
    // Her bir kayıt için zaman dilimlerine göre verileri ayır
    allSupplyHistories.forEach(history => {
      const { symbol, dailySupplies } = history;
      
      // Tarih hesaplamaları için
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      // Tarihe göre sırala (yeniden eskiye)
      const sortedSupplies = [...dailySupplies].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      // En son supply değeri
      const latestSupply = sortedSupplies.length > 0 ? sortedSupplies[0].circulatingSupply : null;
      
      // Zaman dilimlerine göre en yakın supply değerlerini bul
      const findNearestSupply = (targetDate) => {
        let nearest = null;
        let minDiff = Infinity;
        
        for (const supply of sortedSupplies) {
          const supplyDate = new Date(supply.timestamp);
          
          // Sadece hedef tarihten öncekileri değerlendir
          if (supplyDate <= targetDate) {
            const diff = targetDate.getTime() - supplyDate.getTime();
            if (diff < minDiff) {
              minDiff = diff;
              nearest = supply;
            }
          }
        }
        
        return nearest;
      };
      
      // Her zaman dilimi için değerleri bul
      const daySupply = findNearestSupply(oneDayAgo);
      const weekSupply = findNearestSupply(oneWeekAgo);
      const monthSupply = findNearestSupply(oneMonthAgo);
      
      // Sonuç objesine ekle
      result[symbol] = {
        latestSupply,
        daySupply: daySupply ? daySupply.circulatingSupply : null,
        dayDate: daySupply ? daySupply.timestamp : null, 
        weekSupply: weekSupply ? weekSupply.circulatingSupply : null,
        weekDate: weekSupply ? weekSupply.timestamp : null,
        monthSupply: monthSupply ? monthSupply.circulatingSupply : null,
        monthDate: monthSupply ? monthSupply.timestamp : null,
      };
    });
    
    return res.status(StatusCodes.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error in getSupplyDetails:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Supply detayları alınırken hata oluştu",
      error: error.message
    });
  }
};

/**
 * Belirli bir coin için supply detaylarını döndürür
 */
const getCoinSupplyDetails = async (req, res) => {
  try {
    const { symbol } = req.params;
    
    if (!symbol) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Symbol parametresi gerekli"
      });
    }
    
    // Coin için SupplyHistory kaydını bul
    const supplyHistory = await SupplyHistory.findOne({ symbol: symbol.toUpperCase() });
    
    if (!supplyHistory) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: `${symbol} için supply kaydı bulunamadı`
      });
    }
    
    // Tarih hesaplamaları
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Tarihe göre sırala
    const sortedSupplies = [...supplyHistory.dailySupplies].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    // En son supply değeri
    const latestSupply = sortedSupplies.length > 0 ? sortedSupplies[0].circulatingSupply : null;
    
    // Zaman dilimlerine göre en yakın supply değerlerini bul
    const findNearestSupply = (targetDate) => {
      let nearest = null;
      let minDiff = Infinity;
      
      for (const supply of sortedSupplies) {
        const supplyDate = new Date(supply.timestamp);
        
        // Sadece hedef tarihten öncekileri değerlendir
        if (supplyDate <= targetDate) {
          const diff = targetDate.getTime() - supplyDate.getTime();
          if (diff < minDiff) {
            minDiff = diff;
            nearest = supply;
          }
        }
      }
      
      return nearest;
    };
    
    // Her zaman dilimi için değerleri bul
    const daySupply = findNearestSupply(oneDayAgo);
    const weekSupply = findNearestSupply(oneWeekAgo);
    const monthSupply = findNearestSupply(oneMonthAgo);
    
    // Tüm kayıtları ve analiz edilmiş verileri döndür
    return res.status(StatusCodes.OK).json({
      success: true,
      data: {
        symbol: supplyHistory.symbol,
        totalRecords: sortedSupplies.length,
        latestSupply,
        daySupply: daySupply ? daySupply.circulatingSupply : null,
        dayDate: daySupply ? daySupply.timestamp : null,
        weekSupply: weekSupply ? weekSupply.circulatingSupply : null,
        weekDate: weekSupply ? weekSupply.timestamp : null,
        monthSupply: monthSupply ? monthSupply.circulatingSupply : null,
        monthDate: monthSupply ? monthSupply.timestamp : null,
        allSupplies: sortedSupplies
      }
    });
  } catch (error) {
    console.error("Error in getCoinSupplyDetails:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Coin supply detayları alınırken hata oluştu",
      error: error.message
    });
  }
};

/**
 * Tüm coin'ler için supply karşılaştırma raporu
 */
const getSupplyComparisonReport = async (req, res) => {
  try {
    // SupplyHistory kayıtlarını al
    const allSupplyHistories = await SupplyHistory.find({});
    
    // Tarih hesaplamaları
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Her coin için analiz yap
    const comparisonData = [];
    
    for (const history of allSupplyHistories) {
      const { symbol, dailySupplies } = history;
      
      // Tarihe göre sırala
      const sortedSupplies = [...dailySupplies].sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      if (sortedSupplies.length === 0) continue;
      
      // En son supply değeri
      const latestSupply = sortedSupplies[0].circulatingSupply;
      
      // Zaman dilimlerine göre en yakın supply değerlerini bul
      const findNearestSupply = (targetDate) => {
        let nearest = null;
        let minDiff = Infinity;
        
        for (const supply of sortedSupplies) {
          const supplyDate = new Date(supply.timestamp);
          
          // Sadece hedef tarihten öncekileri değerlendir
          if (supplyDate <= targetDate) {
            const diff = targetDate.getTime() - supplyDate.getTime();
            if (diff < minDiff) {
              minDiff = diff;
              nearest = supply;
            }
          }
        }
        
        if (nearest) {
          const diffDays = minDiff / (1000 * 60 * 60 * 24);
          return {
            value: nearest.circulatingSupply,
            date: nearest.timestamp,
            diffDays
          };
        }
        
        return null;
      };
      
      // Her zaman dilimi için değerleri bul
      const dayData = findNearestSupply(oneDayAgo);
      const weekData = findNearestSupply(oneWeekAgo);
      const monthData = findNearestSupply(oneMonthAgo);
      
      // Değişimleri hesapla
      const calculateChange = (oldData) => {
        if (!oldData) return null;
        
        const oldValue = oldData.value;
        if (!oldValue || oldValue <= 0) return null;
        
        const absolute = latestSupply - oldValue;
        const percentage = (absolute / oldValue) * 100;
        
        return {
          absolute,
          percentage,
          oldValue,
          date: oldData.date,
          diffDays: oldData.diffDays
        };
      };
      
      // Karşılaştırma sonuçlarını hesapla
      const dayChange = calculateChange(dayData);
      const weekChange = calculateChange(weekData);
      const monthChange = calculateChange(monthData);
      
      // Sonuç listesine ekle
      comparisonData.push({
        symbol,
        latestSupply,
        changes: {
          day: dayChange,
          week: weekChange,
          month: monthChange
        }
      });
    }
    
    return res.status(StatusCodes.OK).json({
      success: true,
      data: comparisonData,
      timestamp: new Date()
    });
  } catch (error) {
    console.error("Error in getSupplyComparisonReport:", error);
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Supply karşılaştırma raporu oluşturulurken hata oluştu",
      error: error.message
    });
  }
};

module.exports = {
  getSupplyDetails,
  getCoinSupplyDetails,
  getSupplyComparisonReport
}; 