---
name: heizoelpreise
description: Tracks heating oil prices from Swiss providers (Coop, Migrol, Agrola) and provides daily trend analysis via Telegram.
---

# Heating Oil Price Tracker Skill

This skill periodically checks heating oil prices from major Swiss providers and sends a daily summary with trend analysis to a configured Telegram chat.

## Configuration

To use this skill, you need to set the following environment variables in your OpenClaw configuration or a `.env` file within the skill directory:

- `TELEGRAM_BOT_TOKEN`: Your Telegram Bot API token.
- `TELEGRAM_CHAT_ID`: The chat ID where notifications should be sent.
- `ZIP_CODE`: The Swiss postal code (PLZ) for price queries (default: 8000).
- `AMOUNT_LITERS`: The amount of liters for the price query (default: 3000).
- `CRON_SCHEDULE`: Cron expression for the daily report (default: "0 8 * * *" for 8:00 AM).

## Usage

Once installed and configured, the skill will run automatically in the background.

To manually trigger a check or Report:
- `npm run check`: Fetches current prices and saves them to the database.
- `npm run report`: Generates and sends a report based on the latest data.
