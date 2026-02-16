/**
 * Heating Oil Price Skill for OpenClaw
 * 
 * Fetches current heating oil prices from Swiss providers and returns
 * formatted results that can be displayed via OpenClaw.
 * 
 * Usage:
 *   - !heizoel [plz] [menge] - Get current prices
 *   - Skill kann auch als Hintergrund-Job laufen
 */

const PriceService = require('./services/PriceService');
const StorageService = require('./services/StorageService');
const config = require('./config');

// Initialize services
const priceService = new PriceService();
const storage = new StorageService(config.DB_PATH);

/**
 * Hauptfunktion die von OpenClaw aufgerufen wird
 */
async function getHeizoelPrices(zipCode = null, amount = null) {
    const plz = zipCode || config.ZIP_CODE;
    const menge = amount || config.AMOUNT;
    
    console.log(`🔥 Heizöl-Preise für PLZ ${plz} (${menge}L)`);
    console.log('=====================================\n');
    
    try {
        // Preise abrufen mit übergebenen Werten
        const results = await priceService.fetchAndSavePrices(plz, menge);
        
        // Trends analysieren
        const trends = priceService.getAllTrends();
        
        // Formatiere Ausgabe
        const output = formatOutput(trends, plz, menge);
        
        return {
            success: true,
            data: {
                plz,
                menge,
                anbieter: trends,
                summary: results
            },
            formatted: output
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Formatiere die Preise für OpenClaw Ausgabe
 */
function formatOutput(trends, plz, menge) {
    let msg = `🔥 *Heizöl-Preise* 📊\n`;
    msg += `PLZ: ${plz} | Menge: ${menge}L\n\n`;
    
    const anbieterList = [];
    
    for (const [provider, data] of Object.entries(trends)) {
        let icon = '➡️';
        if (data.trend === 'up') icon = '📈';
        if (data.trend === 'down') icon = '📉';
        if (data.trend === 'stable') icon = '➡️';
        if (data.trend === 'insufficient_data') icon = '🆕';
        
        const price = data.currentPrice ? `${data.currentPrice.toFixed(2)} CHF` : 'N/A';
        
        let diffText = '';
        if (data.trend !== 'insufficient_data' && data.difference !== 0) {
            const diff = data.difference > 0 ? `+${data.difference}` : `${data.difference}`;
            diffText = ` (${diff}%)`;
        }
        
        anbieterList.push({
            name: provider,
            price: price,
            trend: data.trend,
            icon: icon,
            diff: diffText
        });
        
        msg += `${icon} *${provider}*: ${price}${diffText}\n`;
    }
    
    // Günstigsten finden
    const valid = anbieterList.filter(a => a.price !== 'N/A');
    if (valid.length > 0) {
        const cheapest = valid.reduce((a, b) => {
            const priceA = parseFloat(a.price);
            const priceB = parseFloat(b.price);
            return priceA < priceB ? a : b;
        });
        msg += `\n🏆 *Günstigster*: ${cheapest.name} (${cheapest.price})`;
    }
    
    return msg;
}

/**
 * CLI Handler für manuellen Aufruf
 */
if (require.main === module) {
    const args = process.argv.slice(2);
    const plz = args[0] || null;
    const amount = args[1] ? parseInt(args[1]) : null;
    
    getHeizoelPrices(plz, amount).then(result => {
        console.log(result.formatted);
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = { getHeizoelPrices, formatOutput };
