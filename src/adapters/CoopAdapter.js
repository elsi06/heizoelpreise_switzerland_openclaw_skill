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
                // Find form fields using Angular attributes
                const inputs = document.querySelectorAll('input');
                let zipInput = null;
                let amountInput = null;
                
                for (const input of inputs) {
                    const placeholder = input.placeholder?.toLowerCase() || '';
                    const name = input.name || '';
                    const id = input.id || '';
                    
                    if (placeholder.includes('plz') || placeholder.includes('post') || name.includes('zip') || id.includes('zip')) {
                        zipInput = input;
                    }
                    if (placeholder.includes('menge') || placeholder.includes('liter') || placeholder.includes('amount') || name.includes('amount') || name.includes('menge')) {
                        amountInput = input;
                    }
                }
                
                // Try to fill inputs
                if (zipInput) {
                    zipInput.value = zip;
                    zipInput.dispatchEvent(new Event('input', { bubbles: true }));
                    zipInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                if (amountInput) {
                    amountInput.value = menge;
                    amountInput.dispatchEvent(new Event('input', { bubbles: true }));
                    amountInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
                
                return {
                    zipFound: !!zipInput,
                    amountFound: !!amountInput,
                    zipValue: zipInput?.value,
                    amountValue: amountInput?.value
                };
            }, zipCode, amount);

            logger.info(`Form fill result: ${JSON.stringify(formResult)}`);

            // Wait for form processing
            await new Promise(r => setTimeout(r, 3000));

            // Look for submit button
            await page.evaluate(() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const text = btn.textContent?.toLowerCase() || '';
                    if (text.includes('angebot') || text.includes('berechnen') || text.includes('submit') || text.includes('next')) {
                        if (!btn.disabled) {
                            btn.click();
                            return;
                        }
                    }
                }
            });

            // Wait for price to load
            await new Promise(r => setTimeout(r, 5000));

            // Extract visible website price first (most trustworthy for end-user comparison)
            const bodyText = await page.evaluate(() => document.body.innerText);
            const pagePrice = this.extractPriceFromPage(bodyText);

            if (pagePrice) {
                const totalPrice = pagePrice * (amount / 100);
                logger.info(`Coop page price: ${pagePrice} CHF/100L × ${amount/100} = ${totalPrice}`);
                return this.createPriceObject(totalPrice.toFixed(2), 'CHF', zipCode, amount);
            }

            // Last resort: API-captured value when page extraction fails.
            if (priceData && priceData.products && priceData.products[0] && priceData.products[0].price) {
                const apiRaw = Number(priceData.products[0].price.value);
                if (Number.isFinite(apiRaw) && apiRaw > 40 && apiRaw < 200) {
                    const totalPrice = apiRaw * (amount / 100);
                    logger.warn(`Coop fallback API price used: ${apiRaw} CHF/100L × ${amount/100} = ${totalPrice}`);
                    return this.createPriceObject(totalPrice.toFixed(2), 'CHF', zipCode, amount);
                }
            }

            throw new Error('Price extraction failed (page + API fallback)');

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

    extractPriceFromPage(text) {
        const patterns = [
            /Total\s*CHF\s*([0-9]+[.,][0-9]{2})/,
            /CHF\s*([0-9]+[.,][0-9]{2})\s*\/[\s]*100/,
            /([0-9]{2,3}[.,][0-9]{2})\s*CHF/
        ];
        for (const p of patterns) {
            const m = text.match(p);
            if (m) {
                const price = parseFloat(m[1].replace(',', '.'));
                if (price > 50 && price < 200) return price;
            }
        }
        return null;
    }
}

module.exports = CoopAdapter;