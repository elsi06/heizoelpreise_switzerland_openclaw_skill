---
name: heizoelpreise
description: Fetches heating oil prices from Swiss providers (Coop, Migrol, Agrola) and displays results via OpenClaw.
metadata:
  {
    "openclaw":
      {
        "emoji": "🔥",
        "requires":
          {
            "bins": ["node", "npm", "chromium"],
          },
      },
  }
---

# Heating Oil Price Tracker Skill

Fetches current heating oil prices from Swiss providers and displays results directly via OpenClaw.

## Usage

Frag mich einfach nach den Heizölpreisen:

```
!heizoel [PLZ] [Liter]
```

Beispiele:
- `!heizoel` → Preise für PLZ 8000 (Standard)
- `!heizoel 8000` → Preise für PLZ 8000
- `!heizoel 8000 3000` → Preise für PLZ 8000, 3000 Liter

## Providers

- **Coop** – Supermarkt
- **Migrol** – Größter Schweizer Brennstoffhändler
- **Agrola** – Regionaler Anbieter

## Output

Der Skill zeigt:
- Aktuelle Preise pro Anbieter
- Preistrend (📈 steigend, 📉 fallend, ➡️ stabil)
- Differenz zum Vortag
- Günstigsten Anbieter 🏆

## Manual Run

```bash
cd ~/.openclaw/skills/heizoelpreise
node src/openclaw.js 8000 3000
```
