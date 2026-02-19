const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class AvianetAdapter extends BaseAdapter {
    constructor() {
        super('AVIA (Osterwalder)');
        this.baseUrl = 'https://pricing.avianet.ch/avianet/json/www';
        this.fid = 'auto'; // 'auto' allows selecting the best supplier
    }

    async fetchPrice(zipCode, amount) {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--no-first-run', '--window-size=1920,1080']
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            logger.info(`${this.providerName}: Using Puppeteer to fetch API context`);

            // We navigate to the page to set up cookies and context
            const targetUrl = `https://pricing.avianet.ch/aviaweb/#app/offerte/eingabe?plz=${zipCode}&menge=${amount}`;
            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Step 1: Get Basic Data and Resolve Location using page.evaluate (to use browser's fetch/XHR)
            const result = await page.evaluate(async (baseUrl, fid, zipCode, amount) => {
                const headers = {
                    'X-my-fid': fid,
                    'X-my-lang': '1',
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                };

                // Helper for fetch
                const fetchJson = async (url, options = {}) => {
                    const res = await fetch(url, options);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                };

                // 1. Basic Data
                const basic = await fetchJson(`${baseUrl}/basic/`, { headers });
                if (!basic || !basic.success) throw new Error('Failed basic data');

                const basicData = basic.data;
                const produktId = basicData.produkte && basicData.produkte.length > 0 ? basicData.produkte[0].id : 296;
                const stueckelung = basicData.produkte && basicData.produkte.length > 0 ? basicData.produkte[0].stueckelung : 100;

                // 2. Resolve Location
                const orts = await fetchJson(`${baseUrl}/ort/?plz=${zipCode}`, { headers });
                if (!orts || orts.length === 0) throw new Error(`ZIP ${zipCode} not found`);

                const location = orts[0];
                
                // 3. Calculate
                const deliveryDate = new Date();
                deliveryDate.setDate(deliveryDate.getDate() + 5);

                const payload = {
                    input: {
                        plz: zipCode.toString(),
                        bestellMenge: amount.toString(),
                        ortId: location.id,
                        ort: location.name,
                        produktId: produktId,
                        produkt: {
                            id: produktId,
                            stueckelung: stueckelung
                        },
                        anzahlAbladestellen: "1",
                        lieferZeitraum: basicData.lieferzeitraumVon || 4,
                        lieferDatum: deliveryDate.toISOString()
                    }
                };

                const calc = await fetchJson(`${baseUrl}/berechnen`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });

                if (!calc || !calc.success || !calc.data) throw new Error('Calc failed');

                const prices = calc.data[produktId];
                if (!prices || prices.length === 0) throw new Error('No prices');

                return {
                    price: prices[0].berechnung.literPreis,
                    provider: prices[0].anbieterName
                };
            }, this.baseUrl, this.fid, zipCode, amount);

            logger.info(`${this.providerName}: Successfully fetched price from ${result.provider}: ${result.price} CHF/100L`);

            const totalPrice = (result.price * amount) / 100;
            return this.createPriceObject(totalPrice.toFixed(2), 'CHF', zipCode, amount);

        } catch (error) {
            logger.error(`${this.providerName} error: ${error.message}`);
            throw error;
        } finally {
            await browser.close();
        }
    }
}

module.exports = AvianetAdapter;
