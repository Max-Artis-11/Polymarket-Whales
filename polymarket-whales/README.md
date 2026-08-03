# Polymarket Whale Scanner

Scans the Polymarket leaderboard for top wallets, filters out hedgers and dead positions, and surfaces trades where multiple whales agree — focused on near-50/50 markets only.

**No backend. No API keys. No auth. Pure client-side.**

## What it does

- Fetches top N wallets from Polymarket's public leaderboard
- For each wallet, grabs their open positions
- **Filters out:**
  - Hedgers (wallets betting NO on 5+ options in the same event, or holding both YES and NO on the same market)
  - Dead positions (current value < 10% of what was paid — lost bets still technically open)
  - Markets outside your chosen probability range (default 35–65%)
- Surfaces markets where ≥ N whales are betting the same direction
- Lets you add your own wallet addresses to track alongside the leaderboard

## Deploy to Vercel

```bash
# 1. Push this repo to GitHub
git init && git add . && git commit -m "init"
gh repo create polymarket-whales --public --push

# 2. Go to vercel.com → New Project → import your repo → Deploy
# That's it. No env vars needed.
```

Or use the Vercel CLI:

```bash
npm i -g vercel
vercel
```

## Run locally

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Filters explained

| Filter | Default | What it does |
|---|---|---|
| Probability range | 35–65% | Only show markets near 50/50 — avoids obvious favourites |
| Min wallets agree | 2 | How many whales must be in the same trade |
| Top N wallets | 50 | How many leaderboard wallets to scan (more = slower) |
| Exclude hedgers | On | Drops wallets doing NO-heavy strategies |

## Notes

- Uses Polymarket's free public data API (`data-api.polymarket.com`) — no key needed
- Rate limited to ~80ms between wallet fetches to be polite
- If leaderboard fetch fails, add wallets manually via the custom wallet field
- The leaderboard endpoint (`/leaderboard?window=all`) may return different field names over time — the code normalises common variants
