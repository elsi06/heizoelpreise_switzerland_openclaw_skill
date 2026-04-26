const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const fs = require('fs'); // Keep fs for debug if needed
const logger = require('../utils/logger');

class AgrolaAdapter extends BaseAdapter {
    constructor() {
        super('Agrola');
        // We use the direct iframe URL to avoid navigating through the main site's heavy wrappers
        this.url = 'https://fenaco-prod-websvc-agropolis-modcustomer-cdne.azureedge.net/de/heizol?language=de';
    }

    async fetchPrice(zipCode, amount) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            // Set viewport to a standard desktop resolution
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // console.log(`visiting ${this.url}`); // Optional: Use a logger if available, otherwise silent or console
            await page.goto(this.url, { waitUntil: 'networkidle2', timeout: 60000 });

            // Wait for form to accept input
            await page.waitForSelector('#postalCodeNpaId', { timeout: 15000 });

            // Type PLZ with delay to trigger validation
            await page.type('#postalCodeNpaId', zipCode.toString(), { delay: 100 });
            await new Promise(r => setTimeout(r, 1000)); // Wait for location dropdown to appear

            // Handle location dropdown that appears after PLZ entry (new UI behavior)
            // The dropdown #postalCodeLocationId appears when multiple locations match the PLZ
            try {
                await page.waitForSelector('#postalCodeLocationId', { timeout: 5000 });
                const locationOptions = await page.evaluate(() => {
                    const select = document.querySelector('#postalCodeLocationId');
                    if (select && select.options.length > 1) {
                        // Select the first non-empty option (index 1, skip "Bitte wählen...")
                        return Array.from(select.options).map(o => ({ value: o.value, text: o.text }));
                    }
                    return null;
                });
                if (locationOptions && locationOptions.length > 1) {
                    // Select first valid location (skip placeholder at index 0)
                    await page.select('#postalCodeLocationId', locationOptions[1].value);
                    logger.info(`Agrola: Selected location "${locationOptions[1].text}" for PLZ ${zipCode}`);
                    await new Promise(r => setTimeout(r, 500)); // Wait for selection to process
                }
            } catch (e) {
                // Location dropdown might not appear for all PLZs - that's OK
                logger.info(`Agrola: No location dropdown for PLZ ${zipCode}, continuing...`);
            }

            // Type Quantity
            // We need to clear the field first as it defaults to 0
            await page.click('#quantityId', { clickCount: 3 });
            await page.type('#quantityId', amount.toString(), { delay: 50 });
            await new Promise(r => setTimeout(r, 500)); // Wait for validation

            // Click submit button
            await page.click('button[type="submit"]');

            // Wait for results
            // We expect an API call or a UI update. 
            // The result usually shows "Angebote" header or pricing.
            // Using waitForResponse is robust, but falling back to selector is good too.
            try {
                await page.waitForResponse(response =>
                    response.url().includes('/api/') && response.status() === 200,
                    { timeout: 10000 }
                );
            } catch (e) {
                // If response wait fails, we might still have the UI, so continue to check UI
            }

            // Wait for the price elements to separate from the previous state
            // "Angebote" header is a good indicator
            try {
                await page.waitForFunction(
                    () => document.body.innerText.includes('Angebote'),
                    { timeout: 10000 }
                );
            } catch (e) {
                // Ignore, maybe text check below handles it
            }

            // Extract Price
            const bodyText = await page.evaluate(() => document.body.innerText);

            // RegEx context:
            // CHF 89.70
            // je 100 Liter bei 3000 Liter
            // 
            // We look for "CHF" followed by a number.
            // Try multiple patterns for Agrola price extraction
            let pricePer100L = null;

            // Pattern 1: "CHF 89.70" or "CHF89.70"
            const m1 = bodyText.match(/CHF\s*([0-9]+[.,][0-9]+)/);
            if (m1) {
                const n = parseFloat(m1[1].replace(',', '.').replace(/'/g, ''));
                if (n >= 60 && n <= 250) pricePer100L = n;
            }

            // Pattern 2: "89.70 CHF" or "89,70 CHF"
            if (!pricePer100L) {
                const m2 = bodyText.match(/([0-9]+[.,][0-9]+)\s*CHF/);
                if (m2) {
                    const n = parseFloat(m2[1].replace(',', '.').replace(/'/g, ''));
                    if (n >= 60 && n <= 250) pricePer100L = n;
                }
            }

            // Pattern 3: price near "100 Liter" or "100l"
            if (!pricePer100L) {
                const m3 = bodyText.match(/([0-9]+[.,][0-9]+)[^\n]{0,30}100\s*[Ll]iter/);
                if (m3) {
                    const n = parseFloat(m3[1].replace(',', '.'));
                    if (n >= 60 && n <= 250) pricePer100L = n;
                }
            }

            if (pricePer100L) {
                const totalPrice = pricePer100L * (amount / 100);
                logger.info(`Agrola: ${pricePer100L} CHF/100L × ${amount/100} = ${totalPrice} CHF for ${amount}L`);
                return this.createPriceObject(totalPrice.toFixed(2), 'CHF', zipCode, amount);
            }

            // Log snippet for debugging
            logger.warn(`Agrola: No price found. Body snippet: ${bodyText.substring(0, 800)}`);
            throw new Error('Price not found in page content (Agrola)');

        } catch (error) {
            // Re-throw with context
            throw new Error(`AgrolaAdapter fetchPrice failed: ${error.message}`);
        } finally {
            if (browser) await browser.close();
        }
    }
}

module.exports = AgrolaAdapter;
