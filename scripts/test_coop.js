const CoopAdapter = require('../src/adapters/CoopAdapter');

(async () => {
    const adapter = new CoopAdapter();
    try {
        console.log('Fetching price for 8000 Zurich, 3000L...');
        const result = await adapter.fetchPrice('8000', 3000);
        console.log('Result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    }
})();
