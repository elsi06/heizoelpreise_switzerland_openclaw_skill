const BaseAdapter = require('./BaseAdapter');
const puppeteer = require('puppeteer');
const logger = require('../utils/logger');
const https = require('https');

class CoopAdapter extends BaseAdapter {
    constructor() {
        super('Coop');
        this.baseUrl = 'https://www.coop-heizoel.ch';
        this.apiBaseUrl = 'https://api.coop-heizoel.ch/occ/v2/cma/heatingOil';
    }

    async fetchPrice(zipCode, amount) {
        // Coop API has shown inconsistent unit semantics in production.
        // Use browser-visible price as primary source, API only as last-resort fallback.
        return this.fetchPriceViaBrowser(zipCode, amount);
    }

    getDeliveryDate() {
        // Get date 14 days from now (Coop usually delivers 2+ weeks out)
        const date = new Date();
        date.setDate(date.getDate() + 14);
        return date.toISOString().split('T')[0];
    }

    fetchFromApi(zipCode, amount, deliveryDate) {
        return new Promise((resolve, reject) => {
            const url = `${this.apiBaseUrl}/productsForPostalcodesAndVolume?postalCode=${zipCode}&volume=${amount}&deliveryDate=${deliveryDate}&productCodes=heating_oil&lang=de&curr=CHF`;
            
            logger.info(`Fetching price from API: ${url}`);
            
            https.get(url, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        
                        // Extract price from API response
                        if (json.products && json.products[0] && json.products[0].price) {
                            const price = json.products[0].price.value;
                            logger.info(`Got price from API: ${price} CHF per 1000L`);
                            resolve(price);
                        } else {
                            reject(new Error('No price found in API response'));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse API response: ${e.message}`));
                    }
                });
            }).on('error', (e) => {
                reject(e);
            });
        });
    }

    async fetchPriceViaBrowser(zipCode, amount) {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });

            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Network monitoring
            let priceData = null;
            page.on('response', async (response) => {
                const url = response.url();
                if (url.includes('productsForPostalcodesAndVolume') && response.status() === 200) {
                    try {
                        const json = await response.json().catch(() => null);
                        if (json && json.products && json.products[0] && json.products[0].price) {
                            logger.info(`Captured price API from: ${url}`);
                            priceData = json;
                        }
                    } catch (e) {}
                }
            });

            logger.info(`Opening ${this.baseUrl}/de/`);
            await page.goto(`${this.baseUrl}/de/`, { waitUntil: 'networkidle0', timeout: 60000 });

            // Wait for Angular to bootstrap
            await page.waitForFunction(() => {
                return window.location.href.includes('coop-heizoel');
            }, { timeout: 30000 });

            // Wait a bit for Angular to initialize
            await new Promise(r => setTimeout(r, 3000));

            // Use page.evaluate to interact with Angular form directly
            const formResult = await page.evaluate(async (zip, menge) => {
                // Find form fields using Angular attributes or plain IDs if available
                const zipInput = document.querySelector('#zipCode');
                const amountInput = document.querySelector('#value'); // Fix: Coop uses #value for amount now
                
                // Try to fill inputs
                if (zipInput) {
                    zipInput.value = zip;
                    zipInput.dispatchEvent(new Event('input', { bubbles: true }));
                    zipInput.dispatchEvent(new Event('change', { bubbles: true }));
                    zipInput.dispatchEvent(new Event('blur', { bubbles: true }));
                }
                
                if (amountInput) {
                    amountInput.value = menge;
                    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                    amountInput.dispatchEvent(new Event('change', { bubbles: true }));
                    amountInput.dispatchEvent(new Event('blur', { bubbles: true }));
                }
                
                return {
                    zipFound: !!zipInput,
                    amountFound: !!amountInput,
                    zipValue: zipInput?.value,
                    amountValue: amountInput?.value
                };
            }, zipCode, amount);

            logger.info(`Form fill result: ${JSON.stringify(formResult)}`);

            // Wait until zip dropdown appears, then select first match
            try {
                // Coop sometimes uses .dropdown-menu or similar for autocomplete
                await page.waitForSelector('.dropdown-item, .autocomplete-result, .typeahead-item, mat-option', { timeout: 15000 });
                const items = await page.$$('.dropdown-item, .autocomplete-result, .typeahead-item, mat-option');
                if (items.length > 0) {
                    await items[0].click();
                    logger.info('Coop: Selected ZIP from dropdown');
                }
            } catch (e) {
                // For some ZIPs no explicit dropdown selection may be needed.
                logger.info('Coop: No explicit ZIP dropdown selection found or needed');
            }

            // Wait for valid form state (zip no longer pending + submit enabled)
            await page.waitForFunction(() => {
                const zip = document.querySelector('#zipCode');
                const amount = document.querySelector('#value');
                const btn = document.querySelector('button.submit');
                const isZipValid = zip && (/ng-valid/.test(zip.className || ''));
                const isAmountValid = amount && (/ng-valid/.test(amount.className || ''));
                return !!zip && !!amount && !!btn && isZipValid && isAmountValid && btn.disabled === false;
            }, { timeout: 30000 });

            const submitBtn = await page.$('button.submit') || await page.$('button[type="submit"]');
            if (submitBtn) {
                await submitBtn.click();
            } else {
                throw new Error('Submit button not found');
            }

            // Wait for result area to render with total/price labels
            await page.waitForFunction(() => {
                const text = document.body.innerText || '';
                return (text.includes('Preis pro 100 Liter') || text.includes('CHF/100L') || text.includes('Preis pro 100l')) && 
                       (text.includes('Total') || text.includes('Gesamtbetrag'));
            }, { timeout: 40000 });

            const bodyText = await page.evaluate(() => document.body.innerText);
            const parsed = this.extractDisplayedPrices(bodyText, amount);
            if (parsed) {
                logger.info(`Coop page result: ${parsed.per100.toFixed(2)} CHF/100L | Total ${parsed.total.toFixed(2)} CHF`);
                return this.createPriceObject(parsed.total.toFixed(2), 'CHF', zipCode, amount);
            }

            // Log body for debugging if we get here
            logger.warn(`Coop: page extraction failed. Body snippet: ${bodyText.substring(0, 500)}`);
            throw new Error('Price extraction failed (page scraping)');

        } catch (error) {
            logger.error(`Error: ${error.message}`);
            throw error;
        } finally {
            if (browser) await browser.close();
        }
    }

    extractPriceFromApi(data) {
        if (!data) return null;
        if (data.products && data.products[0] && data.products[0].price) {
            const price = data.products[0].price.value;
            if (price && typeof price === 'number' && price > 50 && price < 200) return price;
        }
        return null;
    }

    parseChfNumber(str) {
        if (!str) return NaN;
        // Swiss formatting: 3'673,25
        const normalized = str.replace(/'/g, '').replace(/\s/g, '').replace(',', '.');
        return parseFloat(normalized);
    }

    extractDisplayedPrices(text, amount) {
        if (!text) return null;

        // Prefer explicit total shown by Coop result panel
        const totalMatch = text.match(/Total\s*CHF\s*([0-9'.,]+)/i)
            || text.match(/CHF\s*([0-9'.,]+)\s*\n\s*Total/i)
            || text.match(/Abladestelle[^\n]*CHF\s*([0-9'.,]+)/i);

        let total = totalMatch ? this.parseChfNumber(totalMatch[1]) : NaN;

        // Optional explicit per100 label from page
        const per100Match = text.match(/CHF\s*([0-9'.,]+)\s*\n\s*Preis pro 100 Liter/i)
            || text.match(/Preis pro 100 Liter[^\n]*CHF\s*([0-9'.,]+)/i);
        let per100 = per100Match ? this.parseChfNumber(per100Match[1]) : NaN;

        if (!Number.isFinite(total) && Number.isFinite(per100)) {
            total = per100 * (amount / 100);
        }

        if (!Number.isFinite(per100) && Number.isFinite(total)) {
            per100 = total / (amount / 100);
        }

        // Plausibility bounds for CH heating oil
        if (Number.isFinite(total) && Number.isFinite(per100) && per100 >= 60 && per100 <= 250) {
            return { total, per100 };
        }

        return null;
    }
}

module.exports = CoopAdapter;