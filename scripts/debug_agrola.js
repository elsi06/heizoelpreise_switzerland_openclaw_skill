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

    try {
        const url = 'https://fenaco-prod-websvc-agropolis-modcustomer-cdne.azureedge.net/de/heizol?language=de';
        console.log(`Navigating to ${url}...`);

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        console.log('Page loaded. Filling form...');

        // Type PLZ
        await page.waitForSelector('#postalCodeNpaId');
        await page.type('#postalCodeNpaId', '8000');

        // Type Quantity
        await page.waitForSelector('#quantityId');
        // Clear the field first as it has a default value of 0, but typing might just append or prepend if not careful.
        // React fields can be tricky. Best to click, select all, type.
        await page.click('#quantityId', { clickCount: 3 });
        await page.type('#quantityId', '3000');

        console.log('Submitting form...');
        await page.click('button[type="submit"]');

        console.log('Waiting for results...');

        // Wait for something to change. 
        // Since we don't know the result selector yet, let's wait for network idle again or a specific timeout
        // and also listen for responses to see if we can catch the price API call.

        try {
            await page.waitForResponse(response =>
                response.url().includes('/api/') && response.status() === 200,
                { timeout: 10000 }
            );
            console.log('API response detected.');
        } catch (e) {
            console.log('No specific API response detected or timeout.');
        }

        // Give it a little more time for UI to render
        await new Promise(r => setTimeout(r, 5000));

        console.log('Dumping result content...');

        let content = await page.content();
        fs.writeFileSync('agrola_result_dump.html', content);

        const text = await page.evaluate(() => document.body.innerText);
        fs.writeFileSync('agrola_result_text.txt', text);

        console.log('Done.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
