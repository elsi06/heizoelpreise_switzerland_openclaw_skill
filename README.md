# Heizoelpreise Scraper

A Node.js skill for OpenClaw that monitors heating oil prices in Switzerland from three major providers. It tracks price history in a local SQLite database and displays results via OpenClaw.

## Features

- **Multi-Provider Scraping**: Fetches prices from Coop, Migrol, and Agrola using Puppeteer (headless browser automation)
- **API + Browser Fallback**: Coop attempts direct API first, falls back to browser scraping if needed
- **Price Calculation**: Prices are calculated based on amount in liters (per 100L pricing converted to total)
- **Trend Analysis**: Calculates daily price changes (📈 Up / 📉 Down / ➡️ Stable)
- **Price History**: Stores all price records in a local SQLite database (`data/prices.db`)
- **OpenClaw Integration**: Results are displayed directly via OpenClaw messaging

## Configuration

Configuration is managed via environment variables in `.env` file or directly in `src/config.js`.

| Variable | Default | Description |
|----------|---------|-------------|
| `ZIP_CODE` | `8000` | Swiss postal code for price queries (e.g., 8000 = Zurich) |
| `AMOUNT` | `3000` | Amount of heating oil in liters |
| `DB_PATH` | `data/prices.db` | Path to SQLite database |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `NODE_ENV` | `development` | Environment (development/production) |

## Installation

```bash
npm install
```

## Usage

### Query Prices via OpenClaw

Simply ask OpenClaw for heating oil prices:

```
!heizoel [PLZ] [Liter]
```

Examples:
- `!heizoel` → Prices for PLZ 8000 (default)
- `!heizoel 8000` → Prices for PLZ 8000
- `!heizoel 8000 3000` → Prices for PLZ 8000, 3000 liters

### Manual Run (Development)

```bash
node src/openclaw.js 8000 3000
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
│   ├── data/
│   │   ├── zipCityMap.js   # Swiss ZIP to city mapping
│   │   └── prices.db       # SQLite database (created on first run)
│   ├── utils/
│   │   └── logger.js       # Logging utility
│   ├── config.js           # Configuration management
│   └── openclaw.js         # OpenClaw integration
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

Results are displayed via OpenClaw:

```
🔥 Heizöl-Preise 📊
PLZ: 8000 | Menge: 3000L

📉 *Coop*: 266.37 CHF (-2.50%)
➡️ *Migrol*: 268.50 CHF (0.00%)
📈 *Agrola*: 269.10 CHF (+1.20%)

🏆 *Günstigster*: Coop (266.37 CHF)
```

## Providers

- **Coop** – Swiss supermarket
- **Migrol** – Largest Swiss fuel dealer
- **Agrola** – Regional provider

## Troubleshooting

- **No prices extracted**: Check internet connection and ensure target websites are accessible
- **Migrol fails**: Ensure ZIP code exists in `src/data/zipCityMap.js`
- **Headless issues**: Puppeteer requires Chrome/Chromium. On some systems, install manually.

## License

MIT
