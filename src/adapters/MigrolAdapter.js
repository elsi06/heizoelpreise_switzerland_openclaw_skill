const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const logger = require('../utils/logger');

class MigrolAdapter extends BaseAdapter {
    constructor() {
        super('Migrol');
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

            const targetUrl = 'https://www.migrol.ch/de/heizen-waerme/brennstoffe-kaufen/heizoel/heizoel-bestellen/';
            logger.info(`Migrol: Loading ${targetUrl}`);

            // Setup response listener before navigation to capture the API response
            const priceResponsePromise = page.waitForResponse(response => 
                response.url().includes('/migrolapi/de/shop/CalculatePrice') && 
                response.status() === 200 &&
                response.request().method() === 'POST'
            , { timeout: 60000 }).catch(() => null); // Catch timeout to avoid unhandled rejection

            await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Dismiss push notification if present
            try {
                const denyBtn = await page.$('.gb-push-denied');
                if (denyBtn) {
                    await denyBtn.click();
                    // Small pause to let animation finish
                    await new Promise(r => setTimeout(r, 1000));
                }
            } catch (e) { /* ignore */ }

            // 1. Enter ZIP Code
            const zipSelector = '.vs__search';
            try {
                await page.waitForSelector(zipSelector, { timeout: 30000 });
            } catch (e) {
                // Take a screenshot to debug if selector fails
                await page.screenshot({ path: 'migrol_error_selector.png' });
                throw new Error(`Waiting for selector ${zipSelector} failed`);
            }
            
            await page.focus(zipSelector);
            // Clear input first if needed, though usually empty on load
            await page.keyboard.type(zipCode.toString());
            
            // Wait for dropdown options to appear (triggered by ZipcodeCityLookup)
            await new Promise(r => setTimeout(r, 2000)); 
            await page.keyboard.press('Enter'); // Select first option

            // 2. Enter Amount
            const amountSelector = 'input[placeholder="Menge"]';
            await page.waitForSelector(amountSelector, { timeout: 10000 });
            await page.focus(amountSelector);
            
            // Clear existing value
            await page.click(amountSelector, { clickCount: 3 });
            await page.keyboard.press('Backspace');
            
            await page.keyboard.type(amount.toString());

            // 3. Submit
            const btnSelector = 'button.migrol-form__button--green';
            await page.waitForSelector(btnSelector, { timeout: 10000 });
            await page.click(btnSelector);
            logger.info('Migrol: Form submitted, waiting for price...');

            // 4. Wait for API response
            const apiResponse = await priceResponsePromise;
            
            if (!apiResponse) {
                throw new Error('Migrol: Timed out waiting for CalculatePrice API response');
            }

            const priceData = await apiResponse.json();
            
            logger.info(`Migrol: Got API response`);

            // Parse response
            if (!priceData || !priceData.Prices) {
                 throw new Error('Migrol: Invalid API response format (missing Prices)');
            }

            // Find "Heizoel_OekoPlus" with PriceType 1 (Total Price)
            const product = priceData.Prices.find(p => p.Material === 'Heizoel_OekoPlus' && p.PriceType === 1);
            
            if (!product) {
                // Fallback to any PriceType 1 if specific material not found
                const anyTotal = priceData.Prices.find(p => p.PriceType === 1);
                if (anyTotal) {
                     logger.info(`Migrol: Fallback to first available product: ${anyTotal.Material} - ${anyTotal.Price}`);
                     return this.createPriceObject(anyTotal.Price.toFixed(2), 'CHF', zipCode, amount);
                }
                throw new Error('Migrol: No valid price (PriceType 1) found in response');
            }

            logger.info(`Migrol: Price ${product.Price} CHF for ${amount}L (${product.Material})`);
            return this.createPriceObject(product.Price.toFixed(2), 'CHF', zipCode, amount);

        } catch (error) {
            logger.error(`Migrol error: ${error.message}`);
            // Fallback: Try to extract from UI if API parsing fails but UI updated? 
            // For now, let's rely on the API.
            throw error;
        } finally {
            await browser.close();
        }
    }
}

module.exports = MigrolAdapter;
