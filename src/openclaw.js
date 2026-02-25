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

        // Formatiere Ausgabe (inkl. fehlende Anbieter)
        const output = formatOutput(trends, results, plz, menge);

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
function formatOutput(trends, results, plz, menge) {
    let msg = `🔥 *Heizöl-Preise* 📊\n`;
    msg += `PLZ: ${plz} | Menge: ${menge}L\n\n`;

    const expectedProviders = priceService.adapters.map(a => a.providerName);
    const successMap = new Map((results.success || []).map(s => [s.provider, s.price]));
    const failedMap = new Map((results.failed || []).map(f => [f.provider, f.error]));
    const currentRunRows = [];

    for (const provider of expectedProviders) {
        const data = trends[provider] || { trend: 'insufficient_data', difference: 0, currentPrice: null };
        const currentPrice = successMap.has(provider) ? successMap.get(provider) : null;

        if (currentPrice == null) {
            const reason = failedMap.get(provider) || 'keine Daten';
            msg += `⚪ *${provider}*: keine Daten (${reason})\n`;
            continue;
        }

        let icon = '➡️';
        if (data.trend === 'up') icon = '📈';
        if (data.trend === 'down') icon = '📉';
        if (data.trend === 'stable') icon = '➡️';
        if (data.trend === 'insufficient_data') icon = '🆕';

        let diffText = '';
        if (data.trend !== 'insufficient_data' && Number.isFinite(data.difference) && data.difference !== 0) {
            const diff = data.difference > 0 ? `+${data.difference}` : `${data.difference}`;
            diffText = ` (${diff} CHF)`;
        }

        msg += `${icon} *${provider}*: ${currentPrice.toFixed(2)} CHF${diffText}\n`;
        currentRunRows.push({ name: provider, price: currentPrice });
    }

    if (currentRunRows.length > 0) {
        const cheapest = currentRunRows.reduce((a, b) => (a.price < b.price ? a : b));
        const highest = currentRunRows.reduce((a, b) => (a.price > b.price ? a : b));
        const spread = (highest.price - cheapest.price).toFixed(2);
        msg += `\n🏆 *Günstigster*: ${cheapest.name} (${cheapest.price.toFixed(2)} CHF)`;
        msg += `\n↔️ *Spanne*: ${spread} CHF`;
    } else {
        msg += `\n❌ *Fehler: keine Preisdaten*`;
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
