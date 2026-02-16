const AgrolaAdapter = require('../src/adapters/AgrolaAdapter');

(async () => {
    const adapter = new AgrolaAdapter();
    try {
        console.log('Fetching price from Agrola for 8000, 3000L...');
        const result = await adapter.fetchPrice('8000', 3000);
        console.log('Result:', result);
    } catch (error) {
        console.error('Error:', error);
    }
})();
