# Heizoelpreise Scraper

A Node.js skill for OpenClaw that monitors heating oil prices in Switzerland from Coop, Migrol, and Agrola. It tracks price history in a local SQLite database and sends daily notifications via Telegram.

## Features

- **Multi-Provider Scraping**: Fetches prices from Coop, Migrol, and Agrola.
- **Trend Analysis**: Calculates daily price changes (Up/Down/Stable).
- **Persistence**: Stores price history in a local SQLite database (`data/prices.db`).
- **Notifications**: Sends comprehensive reports to Telegram.
- **Scheduling**: Runs automatically every day at 9:00 AM (configurable).
- **Robustness**: Handles dynamic sites using Puppeteer with retry logic.

## Configuration

The application is configured via environment variables or `src/config.js`.

| Variable | Default | Description |
|----------|---------|-------------|
| `ZIP_CODE` | `8000` | Postal code for price queries |
| `AMOUNT` | `3000` | Amount in liters |
| `TELEGRAM_TOKEN` | - | Bot token for notifications |
| `TELEGRAM_CHAT_ID` | - | Chat ID to receive reports |
| `CRON_SCHEDULE` | `0 9 * * *` | Cron schedule for automatic runs |

## Installation

```bash
npm install
```

## Usage

### Start the Scheduler
```bash
npm start
```
The application will start and wait for the scheduled time.

### Trigger Manual Run
```bash
npm start -- --run-now
```
Immedately fetches prices, saves them, and sends a notification/log.

## Project Structure

- `src/adapters/`: Provider-specific scraping logic.
- `src/services/`: Core logic (Price orchestration, Storage, Notifications).
- `src/data/`: Static data (ZIP mappings) and database location.
- `scripts/`: Debug and verification scripts.
