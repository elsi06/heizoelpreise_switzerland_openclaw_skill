const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const zipCityMap = require('../data/zipCityMap');

class MigrolAdapter extends BaseAdapter {
    constructor() {
        super('Migrol');
    }

    async fetchPrice(zipCode, amount) {
        const city = zipCityMap[zipCode];
        if (!city) {
            throw new Error(`City not found for ZIP ${zipCode}. Please update src/data/zipCityMap.js`);
        }

        const browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            const baseUrl = 'https://www.migrol.ch/de/heizen-waerme/brennstoffe-kaufen/heizoel/heizoel-bestellen/';
            const params = new URLSearchParams({
                m: amount.toString(),
                zip: zipCode.toString(),
                city: city,
                c: 'HL2FN26' // Using the code observed in debugging, seems generally valid or default
            });

            const targetUrl = `${baseUrl}?${params.toString()}`;

            let priceData = null;

            // Intercept the API response that contains the price
            page.on('response', async response => {
                const url = response.url();
                if (url.includes('CalculatePrice') && response.request().method() !== 'OPTIONS' && response.status() === 200) {
                    try {
                        priceData = await response.json();
                    } catch (e) {
                        // Ignore JSON parse errors for non-JSON responses
                    }
                }
            });

            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait a short buffer if priceData isn't caught yet
            if (!priceData) {
                try {
                    await page.waitForResponse(response =>
                        response.url().includes('CalculatePrice') && response.status() === 200,
                        { timeout: 30000 }
                    );
                } catch (e) {
                    // Check if we already have it in the listener
                }
            }

            if (!priceData) {
                throw new Error('Migrol API CalculatePrice timed out or failed.');
            }

            // Parse price data
            // Structure: { Prices: [ { Material: 'Heizoel_OekoPlus', PriceType: 2 (per 100L?), Price: 88.83 }, ... ] }
            // We prioritize 'Heizoel_OekoPlus' (standard) and PriceType 2 (unit price?)
            // Wait, PriceType 1 is Total, PriceType 2 seems to be Unit Price?
            // In the dump: PriceType 2 was 88.83, PriceType 1 was 2664.9 (for 3000L). 2664.9/30 = 88.83.
            // So PriceType 2 is Price per 100L.

            const product = priceData.Prices.find(p => p.Material === 'Heizoel_OekoPlus' && p.PriceType === 2);

            if (!product) {
                throw new Error('Price for Heizoel_OekoPlus not found in response.');
            }

            return this.createPriceObject(product.Price, 'CHF', zipCode, amount);

        } finally {
            await browser.close();
        }
    }
}

module.exports = MigrolAdapter;
