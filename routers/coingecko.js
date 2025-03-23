const express = require('express');
const axios = require('axios');
const router = express.Router();

// Memory cache için basit bir obje
const cache = {
  data: null,
  timestamp: null
};

const coinGeckoApi = axios.create({
    baseURL: 'https://api.coingecko.com/api/v3',
    timeout: 10000,
    headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

router.get('/markets', async (req, res) => {
    try {
        // Cache kontrolü (2 dakika)
        if (cache.data && cache.timestamp && Date.now() - cache.timestamp < 2 * 60 * 1000) {
            return res.json(cache.data);
        }

        const response = await coinGeckoApi.get('/coins/markets', {
            params: req.query
        });
        
        // Cache'i güncelle
        cache.data = response.data;
        cache.timestamp = Date.now();
        
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data?.error || error.message 
        });
    }
});

module.exports = router;
