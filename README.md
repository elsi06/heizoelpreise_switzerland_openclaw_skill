# Heizoelpreise Scraper

A Node.js skill for OpenClaw that monitors heating oil prices in Switzerland from three major providers. It tracks price history in a local SQLite database and sends daily trend reports via Telegram.

## Features

- **Multi-Provider Scraping**: Fetches prices from Coop, Migrol, and Agrola using Puppeteer (headless browser automation)
- **API + Browser Fallback**: Coop attempts direct API first, falls back to browser scraping if needed
- **Price Calculation**: Prices are calculated based on amount in liters (per 100L pricing converted to total)
- **Trend Analysis**: Calculates daily price changes (📈 Up / 📉 Down / ➡️ Stable)
- **Price History**: Stores all price records in a local SQLite database (`data/prices.db`)
- **Smart Notifications**: Sends daily reports with current prices, trends, and cheapest provider recommendation
- **Automatic Scheduling**: Runs automatically every day at 8:00 AM (configurable via cron)
- **Manual Trigger**: Run on-demand with `--run-now` flag

## Configuration

Configuration is managed via environment variables in `.env` file or directly in `src/config.js`.

| Variable | Default | Description |
|----------|---------|-------------|
| `ZIP_CODE` | `8000` | Swiss postal code for price queries (e.g., 8000 = Zurich) |
| `AMOUNT` | `3000` | Amount of heating oil in liters |
| `DB_PATH` | `data/prices.db` | Path to SQLite database |
| `TELEGRAM_TOKEN` | - | Bot token for Telegram notifications |
| `TELEGRAM_CHAT_ID` | - | Chat ID to receive reports |
| `CRON_SCHEDULE` | `0 8 * * *` | Cron schedule (default: 8:00 AM daily) |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `NODE_ENV` | `development` | Environment (development/production) |

### Setting up Telegram Notifications

1. Create a Telegram bot via [@BotFather](https://t.me/BotFather)
2. Get your bot token
3. Start a chat with your bot
4. Get your chat ID using `@userinfobot` or the `getChatId` script in `scripts/`
5. Add `TELEGRAM_TOKEN` and `TELEGRAM_CHAT_ID` to your `.env` file

## Installation

```bash
npm install
```

## Usage

### Start the Scheduler (Production)

```bash
npm start
```
The application will start and wait for the scheduled time (default: 8:00 AM daily).

### Trigger Manual Run

```bash
npm start -- --run-now
```
Immediately fetches prices, saves them to the database, and sends a notification.

### Development Mode

```bash
node src/index.js --run-now
```

## Project Structure

```
heizoelpreise/
├── src/
│   ├── adapters/           # Provider-specific scraping logic
│   │   ├── BaseAdapter.js  # Base class for all adapters
│   │   ├── CoopAdapter.js  # Coop scraping (API + browser fallback)
│   │   ├── MigrolAdapter.js # Migrol scraping (browser)
│   │   └── AgrolaAdapter.js # Agrola scraping (browser)
│   ├── services/           # Core business logic
│   │   ├── PriceService.js       # Orchestrates price fetching
│   │   ├── StorageService.js     # SQLite database operations
│   │   └── NotificationService.js # Telegram notifications
│   ├── data/
│   │   ├── zipCityMap.js   # Swiss ZIP to city mapping
│   │   └── prices.db       # SQLite database (created on first run)
│   ├── utils/
│   │   └── logger.js       # Logging utility
│   ├── config.js           # Configuration management
│   └── index.js            # Entry point with cron scheduler
├── scripts/
│   └── getChatId.js        # Utility to get Telegram chat ID
├── .env.example            # Example environment file
├── package.json
└── README.md
```

## Database Schema

The SQLite database (`data/prices.db`) stores price records with the following structure:

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key (auto-increment) |
| provider | TEXT | Provider name (Coop/Migrol/Agrola) |
| price | REAL | Total price in CHF |
| price_per_100l | REAL | Price per 100 liters |
| zip_code | TEXT | Postal code used |
| amount | INTEGER | Amount in liters |
| currency | TEXT | Currency (CHF) |
| timestamp | DATETIME | Record timestamp |

## Output Example

A typical Telegram report looks like:

```
🔥 Heizöl-Preise 16.02.2026 🔥

PLZ: 8000 | Menge: 3000L

*Coop*: 266.37 CHF 📉 (-2.50)
*Migrol*: 268.50 CHF ➡️ (0.00)
*Agrola*: 269.10 CHF 📈 (+1.20)

🏆 *Günstigster Anbieter*: Coop
```

## Troubleshooting

- **No prices extracted**: Check internet connection and ensure target websites are accessible
- **Telegram not working**: Verify bot token and chat ID are correct
- **Migrol fails**: Ensure ZIP code exists in `src/data/zipCityMap.js`
- **Headless issues**: Puppeteer requires Chrome/Chromium. On some systems, install manually.

## License

MIT