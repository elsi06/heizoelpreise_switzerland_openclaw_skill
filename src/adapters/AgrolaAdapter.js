const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const fs = require('fs'); // Keep fs for debug if needed

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
            await new Promise(r => setTimeout(r, 500)); // Wait for validation

            // Type Quantity
            // We need to clear the field first as it defaults to 0
            await page.click('#quantityId', { clickCount: 3 });
            await page.type('#quantityId', amount.toString(), { delay: 50 });
            await new Promise(r => setTimeout(r, 500)); // Wait for validation

            // Ensure button is clickable or submit form
            // await page.click('button[type="submit"]');

            // Try pressing Enter instead, sometimes safer for React forms
            await page.keyboard.press('Enter');

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
            const priceRegex = /CHF\s*([0-9.']+)/;
            const match = bodyText.match(priceRegex);

            if (match) {
                // Clean up format (remove ' just in case, though Agrola seems to use raw dots/numbers usually in this context)
                let priceStr = match[1].replace(/'/g, '');
                let pricePer100L = parseFloat(priceStr);

                // Agrola displays price per 100L directly: "je 100 Liter bei ..."
                // So no need to divide by amount and multiply by 100 like Coop.

                return this.createPriceObject(pricePer100L.toFixed(2), 'CHF', zipCode, amount);
            }

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
