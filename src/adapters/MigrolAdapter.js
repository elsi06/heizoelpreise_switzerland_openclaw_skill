const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const zipCityMap = require('../data/zipCityMap');
const logger = require('../utils/logger');

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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--no-first-run']
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
                c: 'HL2FN26'
            });

            const targetUrl = `${baseUrl}?${params.toString()}`;
            logger.info(`Migrol: Loading ${targetUrl}`);

            // Use waitForResponse for more reliable API capture
            const responsePromise = page.waitForResponse(
                response => response.url().includes('CalculatePrice') && response.status() === 200,
                { timeout: 45000 }
            );

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for the API response
            let priceData = null;
            try {
                const apiResponse = await responsePromise;
                priceData = await apiResponse.json().catch(() => null);
                logger.info(`Migrol: Got CalculatePrice response`);
            } catch (e) {
                logger.warn(`Migrol: API response wait failed: ${e.message}`);
                // Try to extract from page content as fallback
            }

            // Fallback: Try to find price in page content
            if (!priceData || !priceData.Prices) {
                logger.info(`Migrol: Trying fallback extraction from page`);
                const bodyText = await page.evaluate(() => document.body.innerText);
                const priceMatch = bodyText.match(/(\d{2,3}[.,]\d{2})\s*CHF/i);
                if (priceMatch) {
                    const pricePer100L = parseFloat(priceMatch[1].replace(',', '.'));
                    if (pricePer100L > 50 && pricePer100L < 150) {
                        // Price is per 100L - calculate total for requested amount
                        const totalPrice = pricePer100L * (amount / 100);
                        logger.info(`Migrol: Extracted fallback price: ${pricePer100L} × ${amount/100} = ${totalPrice}`);
                        return this.createPriceObject(totalPrice.toFixed(2), 'CHF', zipCode, amount);
                    }
                }
            }

            if (!priceData || !priceData.Prices) {
                throw new Error('Migrol: Could not extract price data');
            }

            // Parse price data - PriceType 2 is price per 100L
            const product = priceData.Prices.find(p => p.Material === 'Heizoel_OekoPlus' && p.PriceType === 2);

            if (!product) {
                throw new Error('Price for Heizoel_OekoPlus not found in response.');
            }

            // Calculate total price: price per 100L × (amount / 100)
            const totalPrice = product.Price * (amount / 100);
            logger.info(`Migrol: ${product.Price} CHF/100L × ${amount/100} = ${totalPrice} CHF for ${amount}L`);
            return this.createPriceObject(totalPrice.toFixed(2), 'CHF', zipCode, amount);

        } catch (error) {
            logger.error(`Migrol error: ${error.message}`);
            throw error;
        } finally {
            await browser.close();
        }
    }
}

module.exports = MigrolAdapter;
