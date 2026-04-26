const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class Heizoel24Adapter extends BaseAdapter {
    constructor() {
        super('Heizoel24 (CH Durchschnitt)');
        this.url = 'https://www.heizoel24.ch/heizoelpreise';
    }

    async fetchPrice(zipCode, amount) {
        try {
            const res = await fetch(this.url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
                    'Accept-Language': 'de-CH,de;q=0.9,en;q=0.8'
                }
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const html = await res.text();

            // Primary: "149,93 CHF pro 100 Liter" pattern in text paragraph
            // heizoel24.ch renders this in a descriptive paragraph about current average price
            let pricePer100L = null;

            const primaryMatch = html.match(/([0-9]{2,3}[,\.][0-9]{1,2})\s*CHF\s*pro\s*100\s*Liter/i);
            if (primaryMatch) {
                const n = parseFloat(primaryMatch[1].replace(',', '.'));
                if (!Number.isNaN(n) && n >= 60 && n <= 250) {
                    pricePer100L = n;
                    logger.info(`Heizoel24: Found price via "CHF pro 100 Liter" pattern: ${pricePer100L}`);
                }
            }

            // Fallback: explicit CHF/100l or CHF/100L unit inline
            if (!pricePer100L) {
                for (const rx of [
                    /([0-9]{2,3}[,\.][0-9]{1,2})\s*CHF\s*\/\s*100\s*l/gi,
                    /([0-9]{2,3}[,\.][0-9]{1,2})\s*Fr\.?\s*\/\s*100\s*l/gi
                ]) {
                    for (const m of html.matchAll(rx)) {
                        const n = parseFloat(m[1].replace(',', '.'));
                        if (!Number.isNaN(n) && n >= 60 && n <= 250) {
                            pricePer100L = n;
                            logger.info(`Heizoel24: Found price via unit pattern: ${pricePer100L}`);
                            break;
                        }
                    }
                    if (pricePer100L) break;
                }
            }

            if (!pricePer100L) {
                throw new Error('CH-Durchschnittspreis auf heizoel24.ch nicht gefunden');
            }

            const totalPrice = pricePer100L * (amount / 100);
            logger.info(`Heizoel24: ${pricePer100L} CHF/100L × ${amount / 100} = ${totalPrice} CHF for ${amount}L (CH average)`);

            return this.createPriceObject(totalPrice.toFixed(2), 'CHF', zipCode, amount);
        } catch (error) {
            throw new Error(`Heizoel24Adapter fetchPrice failed: ${error.message}`);
        }
    }
}

module.exports = Heizoel24Adapter;
