const PriceService = require('./services/PriceService');
const logger = require('./utils/logger');
const config = require('./config');

async function testFetch() {
    console.log('--- Starting Heizöl-Preise Test-Fetch ---');
    
    // Use config values or defaults
    const zipCode = config.ZIP_CODE || '8000';
    const amount = config.AMOUNT || 3000;
    
    console.log(`Testing with ZIP: ${zipCode}, Amount: ${amount}L`);
    
    const priceService = new PriceService();
    
    try {
        const results = await priceService.fetchAndSavePrices(zipCode, amount);
        
        console.log('\n--- Fetch Results Summary ---');
        console.log('Success:');
        results.success.forEach(s => {
            console.log(`  ✅ ${s.provider}: ${s.price} CHF`);
        });
        
        if (results.failed.length > 0) {
            console.log('Failed:');
            results.failed.forEach(f => {
                console.log(`  ❌ ${f.provider}: ${f.error}`);
            });
        }
        
        console.log('\n--- Trend Analysis ---');
        const trends = priceService.getAllTrends();
        Object.entries(trends).forEach(([provider, trend]) => {
            if (trend) {
                const diffStr = trend.difference > 0 ? `+${trend.difference.toFixed(2)}` : trend.difference.toFixed(2);
                console.log(`  ${provider}: ${trend.currentPrice.toFixed(2)} CHF (Diff: ${diffStr} CHF, Trend: ${trend.trend})`);
            } else {
                console.log(`  ${provider}: No trend data available (need at least 2 records)`);
            }
        });

    } catch (error) {
        console.error('Critical test error:', error);
    }
    
    console.log('\n--- Test Finished ---');
    process.exit(0);
}

testFetch();
