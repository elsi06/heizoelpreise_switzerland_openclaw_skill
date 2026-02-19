const BaseAdapter = require('./BaseAdapter');
const logger = require('../utils/logger');

class Heizoel24Adapter extends BaseAdapter {
    constructor() {
        super('Heizoel24 (CH Durchschnitt)');
        this.url = 'https://www.heizoel24.ch/heizölpreise';
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

            // Prefer explicit "CHF/100l" values and filter to plausible range.
            const priceCandidates = [];
            for (const rx of [
                /([0-9]{2,3}[\.,][0-9]{1,2})\s*CHF\s*\/\s*100\s*l/gi,
                /([0-9]{2,3}[\.,][0-9]{1,2})\s*Fr\.?\s*\/\s*100\s*l/gi
            ]) {
                for (const m of html.matchAll(rx)) {
                    if (m && m[1]) {
                        const n = parseFloat(m[1].replace(',', '.'));
                        // Swiss heating oil price per 100L is usually in ~60-150 CHF range.
                        if (!Number.isNaN(n) && n >= 60 && n <= 150) {
                            priceCandidates.push(n);
                        }
                    }
                }
            }

            let pricePer100L = priceCandidates.length ? priceCandidates[0] : null;

            // Fallback around keywords if no explicit unit hit was found.
            if (!pricePer100L) {
                for (const rx of [
                    /Schweiz(?:[^0-9]{0,80})([0-9]{2,3}[\.,][0-9]{1,2})/i,
                    /Durchschnitt(?:[^0-9]{0,80})([0-9]{2,3}[\.,][0-9]{1,2})/i
                ]) {
                    const m = html.match(rx);
                    if (m && m[1]) {
                        const n = parseFloat(m[1].replace(',', '.'));
                        if (!Number.isNaN(n) && n >= 60 && n <= 150) {
                            pricePer100L = n;
                            break;
                        }
                    }
                }
            }

            if (!pricePer100L || Number.isNaN(pricePer100L)) {
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
