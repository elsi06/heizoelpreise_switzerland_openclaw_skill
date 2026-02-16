const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log('Visiting Coop...');
        await page.goto('https://www.coop-heizoel.ch/', { waitUntil: 'networkidle2' });

        await page.waitForSelector('input#value', { timeout: 10000 });
        console.log('Typing amount...');
        await page.type('input#value', '3000', { delay: 100 });

        console.log('Typing zip...');
        await page.type('input#zipCode', '8000', { delay: 200 });

        console.log('Waiting for autocomplete...');
        try {
            await page.waitForSelector('app-swisspost-autocomplete-list li', { timeout: 5000 });
            console.log('Autocomplete list appeared. Clicking first item...');
            await page.click('app-swisspost-autocomplete-list li');
        } catch (e) {
            console.log('Autocomplete list did not appear or timed out. Trying to tab out.');
            await page.keyboard.press('Tab');
        }

        await new Promise(r => setTimeout(r, 1000));

        const submitBtn = await page.waitForSelector('button[type="submit"]');
        const isDisabled = await page.evaluate(el => el.disabled, submitBtn);
        console.log('Submit button disabled:', isDisabled);

        if (!isDisabled) {
            console.log('Clicking submit...');
            await submitBtn.click();

            console.log('Waiting for navigation or price update (non-zero)...');
            try {
                // Wait for CHF followed by a non-zero digit, or ensure 0,00 is gone if possible.
                // Actually, best check is looking for a digit 1-9 after CHF.
                await page.waitForFunction(
                    () => {
                        const text = document.body.innerText;
                        return /CHF\s*[1-9]/.test(text);
                    },
                    { timeout: 45000 } // Give it time
                );
                console.log('Non-zero Price found!');
            } catch (e) {
                console.log('Timed out waiting for non-zero price. Dumping anyway.');
            }
        } else {
            console.log('Button is still disabled. Form validation failed.');
        }

        console.log('Dumping content...');
        const content = await page.evaluate(() => document.body.innerText);
        const html = await page.content();
        fs.writeFileSync('coop_result_text.txt', content);
        fs.writeFileSync('coop_result_dump.html', html);
        console.log('Done.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
})();
