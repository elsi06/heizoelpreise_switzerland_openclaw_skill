const puppeteer = require('puppeteer');
const fs = require('fs');

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
        if (url.includes('api') || url.includes('price') || url.includes('calculate') || url.includes('oil') || url.includes('cart') || url.includes('order')) {
            try {
                const text = await response.text();
                apiCalls.push({ url, status, text: text.substring(0, 1000) });
            } catch (e) {
                apiCalls.push({ url, status, text: 'Could not read' });
            }
        }
    });

    try {
        console.log('Opening page...');
        await page.goto('https://www.coop-heizoel.ch/de/', { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for Angular to initialize
        await new Promise(r => setTimeout(r, 3000));
        
        console.log('Step 1: Filling initial form...');
        
        // Type amount
        await page.waitForSelector('input#value', { timeout: 10000 });
        await page.type('input#value', '3000', { delay: 50 });
        
        // Type zip
        await page.type('input#zipCode', '8000', { delay: 100 });
        
        // Wait for autocomplete and select
        try {
            await page.waitForSelector('app-swisspost-autocomplete-list li', { timeout: 5000 });
            await page.click('app-swisspost-autocomplete-list li');
        } catch (e) {
            console.log('Autocomplete not shown, tabbing...');
            await page.keyboard.press('Tab');
        }
        
        await new Promise(r => setTimeout(r, 1500));
        
        // Click first submit button
        console.log('Clicking submit...');
        const submitBtn = await page.$('button[type="submit"]');
        if (submitBtn) {
            await submitBtn.click();
        }
        
        // Wait for next step
        console.log('Waiting for delivery date selection...');
        await new Promise(r => setTimeout(r, 3000));
        
        // Check if we're on step 2 (delivery date)
        const pageText = await page.evaluate(() => document.body.innerText);
        console.log('After first submit, text contains:', pageText.includes('Lieferzeitraum') ? 'Lieferzeitraum' : 'Unknown');
        
        // Select delivery date (click on first available date in the chart)
        console.log('Selecting delivery date...');
        const dateValues = await page.$$('.value');
        if (dateValues.length > 0) {
            await dateValues[0].click();
            console.log('Clicked first date');
            await new Promise(r => setTimeout(r, 1500));
        }
        
        // Select product (radio button)
        console.log('Selecting product...');
        const productRadios = await page.$$('input[type="radio"]');
        if (productRadios.length > 0) {
            await productRadios[0].click();
            console.log('Clicked first product radio');
            await new Promise(r => setTimeout(r, 2000));
        }
        
        // Check for price after product selection
        let priceFound = false;
        for (let i = 0; i < 15; i++) {
            const currentText = await page.evaluate(() => document.body.innerText);
            const priceMatch = currentText.match(/CHF\s*([0-9]{2,3}[.,][0-9]{2})/);
            if (priceMatch && priceMatch[1] !== '0,00' && priceMatch[1] !== '0.00') {
                console.log(`Price found after ${i+1}s: CHF ${priceMatch[1]}`);
                priceFound = true;
                break;
            }
            await new Promise(r => setTimeout(r, 1000));
        }
        
        // If still no price, click "Zum Warenkorb"
        if (!priceFound) {
            console.log('Clicking "Zum Warenkorb"...');
            const cartButtons = await page.$$('button');
            for (const btn of cartButtons) {
                const text = await btn.evaluate(el => el.textContent);
                if (text.includes('WARENKORB')) {
                    await btn.click();
                    console.log('Clicked cart button');
                    await new Promise(r => setTimeout(r, 5000));
                    break;
                }
            }
        }
        
        // Final check for price
        console.log('\n=== Final Price Check ===');
        const finalText = await page.evaluate(() => document.body.innerText);
        const priceMatches = finalText.match(/CHF\s*([0-9]{2,3}[.,][0-9]{2})/g);
        console.log('Price matches found:', priceMatches);
        
        // Save results
        fs.writeFileSync('coop_full_text.txt', finalText);
        fs.writeFileSync('coop_full_html.html', await page.content());
        
        console.log('\n=== API Calls ===');
        for (const call of apiCalls) {
            console.log(`[${call.status}] ${call.url}`);
            console.log(call.text);
            console.log('---');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
