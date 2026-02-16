const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class CoopAdapter extends BaseAdapter {
    constructor() {
        super('Coop');
        this.url = 'https://www.coop-heizoel.ch/';
    }

    async fetchPrice(zipCode, amount) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Set viewport to a desktop resolution
            await page.setViewport({ width: 1280, height: 800 });

            logger.info(`Visiting ${this.url}`);
            await page.goto(this.url, { waitUntil: 'networkidle2' });

            // Wait for form input
            await page.waitForSelector('input#value', { timeout: 10000 });

            // Type amount
            await page.type('input#value', amount.toString());

            // Type zip code (needs to be typed slowly to trigger autocomplete)
            await page.type('input#zipCode', zipCode.toString(), { delay: 100 });

            // Wait for autocomplete or validation
            await new Promise(r => setTimeout(r, 1000));

            // Click submit
            const submitBtn = await page.waitForSelector('button[type="submit"]');

            // Check if disabled and handle autocomplete if needed
            const isDisabled = await page.evaluate(el => el.disabled, submitBtn);
            if (isDisabled) {
                // Try to click the first autocomplete option if available
                try {
                    await page.waitForSelector('app-swisspost-autocomplete-list li', { timeout: 2000 });
                    await page.click('app-swisspost-autocomplete-list li');
                } catch (e) {
                    // If no list, try tabbing
                    await page.keyboard.press('Tab');
                }
                await new Promise(r => setTimeout(r, 500));
            }

            // Click submission
            await submitBtn.click();

            // Wait for "Lieferzeitraum und Produkt wählen" section
            try {
                await page.waitForSelector('h2', { timeout: 20000 });
            } catch (e) {
                logger.warn('Header "Lieferzeitraum und Produkt wählen" not found, checking if price is already there');
            }

            // Click on the first product option (Standard/Oeko)
            // We look for a clickable element that might be a product card
            try {
                // Try to find a header with "Heizöl" and click it or its parent
                const product = await page.$x('//div[contains(@class, "purchase-list-item-panel")]');
                if (product.length > 0) {
                    // Usually the panel itself isn't clickable, but maybe an element inside?
                    // In the dump, the options seem to be "purchase-list-item".
                    // Let's try clicking the "purchase-list-item-panel" or "purchase-list-item-header"
                    // Actually line 36 of dump says "Bitte ein Produkt auswählen".
                    // I'll try clicking the first .purchase-list-item-panel
                    await product[0].click();
                } else {
                    // Fallback, try finding text "Öko"
                    const oeko = await page.$x('//*[contains(text(), "Öko")]');
                    if (oeko.length > 0) await oeko[0].click();
                }
            } catch (e) {
                logger.warn('Could not click product specifically, trying generic selector');
            }

            // Wait for price to update from 0.00
            await page.waitForFunction(
                () => {
                    const text = document.body.innerText;
                    // Look for Total that is NOT 0,00. 
                    const match = text.match(/Total\s*\n*CHF\s*([0-9.'’]+,[0-9]{2})/);
                    if (match) {
                        const val = match[1].replace(/['’]/g, '').replace(',', '.');
                        return parseFloat(val) > 0;
                    }
                    return false;
                },
                { timeout: 20000 }
            );

            // Extract price
            const bodyText = await page.evaluate(() => document.body.innerText);

            // Regex for Total Price: "Total\nCHF 3.456,70"
            const totalRegex = /Total\s*\n*CHF\s*([0-9.'’]+,[0-9]{2})/;
            const match = bodyText.match(totalRegex);

            if (match) {
                let priceStr = match[1].replace(/['’]/g, '').replace(',', '.'); // Remove thousands separator, fix decimal
                let totalPrice = parseFloat(priceStr);

                // Calculate price per 100L. The total is for the requested amount.
                let pricePer100L = (totalPrice / amount) * 100;

                return this.createPriceObject(pricePer100L.toFixed(2), 'CHF', zipCode, amount);
            }

            throw new Error('Price not found in page content after waiting');

        } catch (error) {
            logger.error(`Error fetching form Coop: ${error.message}`);
            throw error;
        } finally {
            if (browser) await browser.close();
        }
    }
}

module.exports = CoopAdapter;
