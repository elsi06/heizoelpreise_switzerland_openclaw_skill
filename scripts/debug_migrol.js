const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    let priceData = null;

    page.on('response', async response => {
        const url = response.url();
        if (url.includes('CalculatePrice') && response.request().method() !== 'OPTIONS') {
            console.log('Intercepted CalculatePrice response:', response.status());
            try {
                const data = await response.json();
                console.log('Price Data received!');
                priceData = data;
                fs.writeFileSync('migrol_price_data.json', JSON.stringify(data, null, 2));
            } catch (e) {
                console.error('Failed to parse JSON:', e);
            }
        }
    });

    try {
        const baseUrl = 'https://www.migrol.ch/de/heizen-waerme/brennstoffe-kaufen/heizoel/heizoel-bestellen/';
        const params = new URLSearchParams({
            m: '3000',
            zip: '8000',
            city: 'Zürich',
            c: 'HL2FN26'
        });

        const directUrl = `${baseUrl}?${params.toString()}`;
        console.log(`Navigating directly to ${directUrl}...`);

        await page.goto(directUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait a bit to ensure response is captured
        await new Promise(r => setTimeout(r, 10000)); // Increased wait

        if (priceData) {
            console.log('SUCCESS: Price data captured via API interception.');
        } else {
            console.log('WARNING: CalculatePrice response not captured.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
