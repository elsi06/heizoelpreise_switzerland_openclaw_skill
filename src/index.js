const cron = require('node-cron');
const config = require('./config');
const PriceService = require('./services/PriceService');
const NotificationService = require('./services/NotificationService');
const logger = require('./utils/logger');

// Initialize Services
const priceService = new PriceService();
const notificationService = new NotificationService();

async function runJob() {
    logger.info('Running scheduled heating oil price job...');
    try {
        // 1. Fetch Prices
        const fetchResults = await priceService.fetchAndSavePrices();

        const successCount = fetchResults.success.length;
        const failedCount = fetchResults.failed.length;

        logger.info(`Job finished. Success: ${successCount}, Failed: ${failedCount}`);

        // 2. Analyze Trends
        const trends = priceService.getAllTrends();

        // 3. Send Notification
        await notificationService.sendDailyReport(trends);

    } catch (error) {
        logger.error(`Job failed with critical error: ${error.message}`);
    }
}

// Manual Trigger
if (process.argv.includes('--run-now')) {
    logger.info('Manual run triggered...');
    runJob().then(() => {
        logger.info('Manual run complete. Exiting.');
        process.exit(0);
    });
} else {
    // Schedule Job
    logger.info(`Starting Heizoelpreise Scheduler. Schedule: ${config.CRON_SCHEDULE}`);
    cron.schedule(config.CRON_SCHEDULE, () => {
        runJob();
    });

    // Keep process alive
    logger.info('Scheduler is running. Press Ctrl+C to exit.');
}
