const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
    const url = process.argv[2];
    const outputFile = process.argv[3];

    if (!url || !outputFile) {
        console.error('Usage: node inspect_site.js <URL> <OUTPUT_FILE>');
        process.exit(1);
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        const content = await page.content();
        fs.writeFileSync(outputFile, content);
        console.log(`HTML saved to ${outputFile}`);
    } catch (error) {
        console.error('Error fetching page:', error);
    } finally {
        await browser.close();
    }
})();
