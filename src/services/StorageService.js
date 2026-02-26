const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

class StorageService {
    constructor(dbPath) {
        // Ensure directory exists
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        this.db = new Database(dbPath);
        this.init();
    }

    init() {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,
                price REAL NOT NULL,
                currency TEXT NOT NULL,
                amount_liters INTEGER NOT NULL,
                zip_code TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        `;
        this.db.prepare(createTableQuery).run();
        logger.info('Database initialized and prices table checked/created.');
    }

    /**
     * Saves a price record to the database.
     * @param {Object} priceData - The price object from an adapter.
     */
    savePrice(priceData) {
        const { provider, price, currency, amount_liters, zip_code, timestamp } = priceData;
        const stmt = this.db.prepare(`
            INSERT INTO prices (provider, price, currency, amount_liters, zip_code, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(provider, price, currency, amount_liters, zip_code, timestamp);
        logger.info(`Saved price for ${provider}: ${price} ${currency} (ID: ${info.lastInsertRowid})`);
        return info;
    }

    /**
     * Retrieves price history for a provider over the last N days.
     * @param {string} provider - The provider name.
     * @param {number} days - Number of days to look back.
     * @returns {Array} - Array of price records.
     */
    getPriceHistory(provider, days = 30) {
        const stmt = this.db.prepare(`
            SELECT * FROM prices 
            WHERE provider = ? 
            AND created_at >= date('now', '-' || ? || ' days')
            ORDER BY created_at ASC
        `);
        return stmt.all(provider, days);
    }

    /**
     * Get the latest price entry for a provider.
     * @param {string} provider 
     */
    getLatestPrice(provider) {
        const stmt = this.db.prepare(`
            SELECT * FROM prices 
            WHERE provider = ? 
            ORDER BY created_at DESC 
            LIMIT 1
        `);
        return stmt.get(provider);
    }

    /**
     * Calculates the trend based on the latest two entries.
     * @param {string} provider 
     * @returns {Object} - { currentPrice, previousPrice, difference, trend: 'up'|'down'|'stable' }
     */
    getDailyTrend(provider) {
        const stmt = this.db.prepare(`
            SELECT * FROM prices 
            WHERE provider = ? 
            ORDER BY created_at DESC 
            LIMIT 2
        `);
        const rows = stmt.all(provider);

        if (rows.length < 2) {
            return {
                provider,
                currentPrice: rows[0]?.price || null,
                previousPrice: null,
                difference: 0,
                trend: 'insufficient_data'
            };
        }

        const current = rows[0];
        const previous = rows[1];
        const diff = current.price - previous.price;
        let trend = 'stable';
        if (diff > 0) trend = 'up';
        if (diff < 0) trend = 'down';

        return {
            provider,
            currentPrice: current.price,
            previousPrice: previous.price,
            difference: parseFloat(diff.toFixed(2)),
            trend
        };
    }

    /**
     * Trend over the last N entries for a specific provider/zip/amount.
     * Compares oldest vs newest entry in the window.
     */
    getTrendLastN(provider, zipCode, amountLiters, n = 10) {
        const stmt = this.db.prepare(`
            SELECT * FROM prices
            WHERE provider = ?
              AND zip_code = ?
              AND amount_liters = ?
            ORDER BY created_at DESC
            LIMIT ?
        `);
        const rows = stmt.all(provider, String(zipCode), Number(amountLiters), Number(n));

        if (!rows.length) {
            return {
                trend: 'insufficient_data',
                count: 0,
                deltaTotal: 0,
                deltaPercent: 0,
                deltaPer100: 0
            };
        }

        if (rows.length < 2) {
            return {
                trend: 'insufficient_data',
                count: rows.length,
                deltaTotal: 0,
                deltaPercent: 0,
                deltaPer100: 0
            };
        }

        const newest = rows[0];
        const oldest = rows[rows.length - 1];

        const deltaTotal = newest.price - oldest.price;
        const deltaPercent = oldest.price ? (deltaTotal / oldest.price) * 100 : 0;

        const factor = Number(amountLiters) / 100;
        const newestPer100 = newest.price / factor;
        const oldestPer100 = oldest.price / factor;
        const deltaPer100 = newestPer100 - oldestPer100;

        let trend = 'stable';
        if (deltaTotal > 0) trend = 'up';
        if (deltaTotal < 0) trend = 'down';

        return {
            trend,
            count: rows.length,
            deltaTotal: parseFloat(deltaTotal.toFixed(2)),
            deltaPercent: parseFloat(deltaPercent.toFixed(2)),
            deltaPer100: parseFloat(deltaPer100.toFixed(2))
        };
    }
}

module.exports = StorageService;
