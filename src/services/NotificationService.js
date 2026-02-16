const TelegramBot = require('node-telegram-bot-api');
const config = require('../config');
const logger = require('../utils/logger');

class NotificationService {
    constructor() {
        this.token = config.TELEGRAM_TOKEN;
        this.chatId = config.TELEGRAM_CHAT_ID;
        this.bot = null;

        if (this.token) {
            this.bot = new TelegramBot(this.token, { polling: false });
        } else {
            logger.warn('Telegram Token not provided. NotificationService will only log messages.');
        }
    }

    /**
     * Sends a daily report with price trends.
     * @param {Object} trends - The trends object from PriceService.getAllTrends()
     */
    async sendDailyReport(trends) {
        const message = this.formatReport(trends);

        if (this.bot && this.chatId) {
            try {
                await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
                logger.info('Daily report sent to Telegram.');
            } catch (error) {
                logger.error(`Failed to send Telegram message: ${error.message}`);
            }
        } else {
            logger.info('--- DAILY REPORT (Simulation) ---');
            logger.info('\n' + message);
            logger.info('---------------------------------');
        }
    }

    /**
     * Formats the trend data into a readable message.
     * @param {Object} trends 
     * @returns {string}
     */
    formatReport(trends) {
        const date = new Date().toLocaleDateString('de-CH');
        let msg = `🔥 *Heizöl-Preise ${date}* 🔥\n\n`;
        msg += `PLZ: ${config.ZIP_CODE} | Menge: ${config.AMOUNT}L\n\n`;

        for (const [provider, data] of Object.entries(trends)) {
            let icon = '➡️';
            if (data.trend === 'up') icon = 'XY'; // Placeholder, fix below
            if (data.trend === 'down') icon = 'YZ';

            // Better icons
            if (data.trend === 'up') icon = '📈';
            if (data.trend === 'down') icon = '📉';
            if (data.trend === 'stable') icon = '➡️';
            if (data.trend === 'insufficient_data') icon = '🆕';

            const price = data.currentPrice ? `${data.currentPrice.toFixed(2)} CHF` : 'N/A';
            const diff = data.difference > 0 ? `+${data.difference}` : `${data.difference}`;

            msg += `*${provider}*: ${price} ${icon}`;

            if (data.trend !== 'insufficient_data' && data.difference !== 0) {
                msg += ` (${diff})`;
            }
            msg += `\n`;
        }

        // Add cheapest recommendation
        const validPrices = Object.values(trends).filter(t => t.currentPrice !== null);
        if (validPrices.length > 0) {
            const cheapest = validPrices.reduce((prev, curr) => prev.currentPrice < curr.currentPrice ? prev : curr);
            msg += `\n🏆 *Günstigster Anbieter*: ${cheapest.provider}`;
        }

        return msg;
    }
}

module.exports = NotificationService;
