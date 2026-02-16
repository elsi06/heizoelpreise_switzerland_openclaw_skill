const PriceService = require('../src/services/PriceService');

(async () => {
    console.log('Testing PriceService (Integration Test)...');
    const service = new PriceService();

    try {
        console.log('Fetching prices (this may take a while)...');
        const results = await service.fetchAndSavePrices();
        console.log('Fetch Results:', JSON.stringify(results, null, 2));

        console.log('Getting Trends...');
        const trends = service.getAllTrends();
        console.log('Trends:', JSON.stringify(trends, null, 2));

    } catch (error) {
        console.error('PriceService Test Failed:', error);
    }
})();
