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
                    this.storage.savePrice(priceData);
                    results.success.push({
                        provider: adapter.providerName,
                        price: priceData.price
                    });
                    logger.info(`Successfully saved price for ${adapter.providerName}`);
                }
            } catch (error) {
                logger.error(`Failed to fetch from ${adapter.providerName}: ${error.message}`);
                results.failed.push({
                    provider: adapter.providerName,
                    error: error.message
                });
            }
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
