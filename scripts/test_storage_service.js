const StorageService = require('../src/services/StorageService');
const path = require('path');
const fs = require('fs');

const testDbPath = path.join(__dirname, '../data/test_prices.db');

// Cleanup previous test
if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
}

const storage = new StorageService(testDbPath);

(async () => {
    try {
        console.log('Testing StorageService...');

        // 1. Save Price 1
        const price1 = {
            provider: 'TestProvider',
            price: 100.50,
            currency: 'CHF',
            amount_liters: 3000,
            zip_code: '8000',
            timestamp: new Date(Date.now() - 86400000).toISOString() // Yesterday
        };
        storage.savePrice(price1);
        console.log('Saved Price 1');

        // 2. Save Price 2 (Today, higher)
        const price2 = {
            provider: 'TestProvider',
            price: 102.00,
            currency: 'CHF',
            amount_liters: 3000,
            zip_code: '8000',
            timestamp: new Date().toISOString()
        };
        storage.savePrice(price2);
        console.log('Saved Price 2');

        // 3. Get History
        const history = storage.getPriceHistory('TestProvider', 7);
        console.log(`History count: ${history.length} (expected 2)`);
        if (history.length !== 2) throw new Error('History count mismatch');

        // 4. Get Latest
        const latest = storage.getLatestPrice('TestProvider');
        console.log(`Latest Price: ${latest.price} (expected 102)`);
        if (latest.price !== 102) throw new Error('Latest price mismatch');

        // 5. Get Trend
        const trend = storage.getDailyTrend('TestProvider');
        console.log('Trend:', trend);
        if (trend.trend !== 'up') throw new Error('Trend should be UP');
        if (trend.difference !== 1.5) throw new Error('Difference should be 1.5');

        console.log('StorageService Verified Successfully!');

    } catch (error) {
        console.error('StorageService Verification Failed:', error);
    } finally {
        // Cleanup
        if (fs.existsSync(testDbPath)) {
            // fs.unlinkSync(testDbPath); // Keep for inspection if needed, or remove
        }
    }
})();
