const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const apiCalls = [];
    
    page.on('response', async (response) => {
        const url = response.url();
        const status = response.status();
        if (url.includes('api') || url.includes('price') || url.includes('calculate') || url.includes('product') || url.includes('oil')) {
            try {
                const text = await response.text();
                apiCalls.push({ url, status, text: text.substring(0, 500) });
            } catch (e) {
                apiCalls.push({ url, status, text: 'Could not read' });
            }
        }
    });

    try {
        console.log('Opening page...');
        await page.goto('https://www.coop-heizoel.ch/de/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for page to initialize
        await new Promise(r => setTimeout(r, 2000));
        
        console.log('Filling form...');
        
        // Type amount
        await page.waitForSelector('input#value', { timeout: 10000 });
        await page.type('input#value', '3000', { delay: 50 });
        
        // Type zip
        await page.type('input#zipCode', '8000', { delay: 100 });
        
        // Wait for autocomplete
        try {
            await page.waitForSelector('app-swisspost-autocomplete-list li', { timeout: 5000 });
            await page.click('app-swisspost-autocomplete-list li');
        } catch (e) {
            await page.keyboard.press('Tab');
        }
        
        await new Promise(r => setTimeout(r, 1000));
        
        console.log('Clicking submit...');
        const submitBtn = await page.waitForSelector('button[type="submit"]');
        await submitBtn.click();
        
        console.log('Waiting for price to load...');
        // Wait up to 30 seconds for price
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 1000));
            const text = await page.evaluate(() => document.body.innerText);
            if (text.includes('CHF') && !text.includes('CHF 0,00') && text.match(/CHF\s*[1-9][0-9]/)) {
                console.log('Price loaded after', i+1, 'seconds');
                break;
            }
            if (i % 5 === 0) {
                console.log('Still waiting...', i+1, 'seconds');
            }
        }
        
        console.log('\n=== API Calls captured ===');
        for (const call of apiCalls) {
            console.log(`\n[${call.status}] ${call.url}`);
            console.log(call.text);
        }
        
        // Get final page text
        console.log('\n=== Final Page Text (relevant) ===');
        const finalText = await page.evaluate(() => document.body.innerText);
        const relevantLines = finalText.split('\n').filter(line => 
            line.includes('CHF') || line.includes('Preis') || line.includes('Total') || line.includes('Liter')
        );
        console.log(relevantLines.join('\n'));

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();