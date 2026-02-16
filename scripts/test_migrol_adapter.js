const MigrolAdapter = require('../src/adapters/MigrolAdapter');

(async () => {
    const adapter = new MigrolAdapter();
    try {
        console.log('Fetching price for 8048 Zürich, 3000L...');
        const result = await adapter.fetchPrice('8048', 3000);
        console.log('Success:', result);
    } catch (error) {
        console.error('Error:', error);
    }
})();
