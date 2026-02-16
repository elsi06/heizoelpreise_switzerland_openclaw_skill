require('dotenv').config();
const path = require('path');

module.exports = {
    // Application
    ENV: process.env.NODE_ENV || 'development',

    // Scraper Settings
    ZIP_CODE: process.env.ZIP_CODE || '8000', // Default Zurich
    AMOUNT: parseInt(process.env.AMOUNT || '3000', 10), // Default 3000L

    // Database
    DB_PATH: process.env.DB_PATH || path.join(__dirname, '../data/prices.db'),

    // Telegram
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN || '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || '',

    // Scheduler (Cron)
    CRON_SCHEDULE: process.env.CRON_SCHEDULE || '0 8 * * *', // Every day at 8:00 AM

    // Logging
    LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};
