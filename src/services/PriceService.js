const CoopAdapter = require('../adapters/CoopAdapter');
const MigrolAdapter = require('../adapters/MigrolAdapter');
const AgrolaAdapter = require('../adapters/AgrolaAdapter');
const AvianetAdapter = require('../adapters/AvianetAdapter');
const Heizoel24Adapter = require('../adapters/Heizoel24Adapter');
const StorageService = require('./StorageService');
const config = require('../config');
const logger = require('../utils/logger');

class PriceService {
    constructor() {
        this.adapters = [
            new CoopAdapter(),
            new MigrolAdapter(),
            new AgrolaAdapter(),
            new AvianetAdapter(),
            new Heizoel24Adapter()
        ];
        this.storage = new StorageService(config.DB_PATH);
    }

    /**
     * Fetches prices from all configured adapters and saves them to storage.
     * @param {string} zipCodeOverride - Override ZIP code from config
     * @param {number} amountOverride - Override amount from config
     * @returns {Promise<Object>} Summary of operations { success: [], failed: [] }
     */
    async fetchAndSavePrices(zipCodeOverride = null, amountOverride = null) {
        const results = {
            success: [],
            failed: []
        };
        const pendingSuccess = [];

        const zipCode = zipCodeOverride || config.ZIP_CODE;
        const amount = amountOverride || config.AMOUNT;

        logger.info(`Starting price fetch for Zip: ${zipCode}, Amount: ${amount}L`);

        // We run sequentially to avoid overloading the system/network, though parallel is possible.
        // Parallel might trigger bot detection if from same IP too fast? 
        // Let's do sequential for robustness first.

        for (const adapter of this.adapters) {
            try {
                logger.info(`Fetching from ${adapter.providerName}...`);
                const priceData = await adapter.fetchPrice(zipCode, amount);

                if (priceData) {
                    pendingSuccess.push({
                        provider: adapter.providerName,
                        price: priceData.price,
                        _priceData: priceData
                    });
                    logger.info(`Fetched price for ${adapter.providerName}`);
                }
            } catch (error) {
                logger.error(`Failed to fetch from ${adapter.providerName}: ${error.message}`);
                results.failed.push({
                    provider: adapter.providerName,
                    error: error.message
                });
            }
        }

        // Plausibility check: flag strong outliers vs market median.
        // Works on CHF/100L equivalent (for configured amount).
        const toPer100 = (total) => Number(total) / (amount / 100);
        const ok = pendingSuccess
            .map(s => ({ ...s, per100: toPer100(s.price) }))
            .filter(s => Number.isFinite(s.per100));

        let outlierProviders = new Set();
        if (ok.length >= 3) {
            const sorted = ok.map(x => x.per100).sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;

            const outliers = ok.filter(x => Math.abs(x.per100 - median) > 8);
            for (const o of outliers) {
                outlierProviders.add(o.provider);
                logger.warn(`Plausibility filter: ${o.provider} flagged as outlier (${o.per100.toFixed(2)} CHF/100L vs median ${median.toFixed(2)})`);
                results.failed.push({
                    provider: o.provider,
                    error: `Plausibility check failed (${o.per100.toFixed(2)} CHF/100L vs median ${median.toFixed(2)})`
                });
            }
        }

        // Persist only plausible prices
        for (const s of pendingSuccess) {
            if (outlierProviders.has(s.provider)) continue;
            this.storage.savePrice(s._priceData);
            results.success.push({ provider: s.provider, price: s.price });
            logger.info(`Successfully saved price for ${s.provider}`);
        }

        return results;
    }

    /**
     * Get price history for analysis
     */
    getHistory(provider, days = 30) {
        return this.storage.getPriceHistory(provider, days);
    }

    /**
     * Get daily trends for all providers
     */
    getAllTrends() {
        const trends = {};
        for (const adapter of this.adapters) {
            trends[adapter.providerName] = this.storage.getDailyTrend(adapter.providerName);
        }
        return trends;
    }
}

module.exports = PriceService;
