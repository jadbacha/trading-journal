# Trading Journal

A simple journal for a The Trading Pit futures account. Each day on the calendar turns:

- **green** when the day's net P&L is positive
- **red** when it's negative
- **gray** when it's breakeven (exactly 0, or within a ± range you set in Settings)

A **challenge tracker** above the calendar follows your prop-firm objectives: profit target, consistency (best day
vs. its cap), today's loss against the daily limit, room left above the (trailing) max drawdown floor, and trading
days, plus a countdown to the challenge deadline. It's preset for The Trading Pit Futures Prime $50,000 challenge, and **Settings → Challenge** changes the rules.
Days that came within 80% of the daily loss limit get an orange ⚠, days that hit it get ⛔, and days over the
consistency cap get ⚑.

Below the monthly summary, **Performance** shows win rate, average win, average loss (with the win/loss ratio) and
profit factor for the month on screen or all time. These are per trade and after commissions; breakeven trades
don't count toward the win rate.

Click a day to open its journal:

- **Pre-market plan:** write your bias, levels, setups and max loss before the session.
- **Review:** after the close, compare what happened with the plan and rate how well you followed it.
- **Screenshots:** the plan and the review each have their own. Paste a chart (⌘V) while typing in that box,
  drop it on the box, or click to pick a file. Click a thumbnail to see it full size.
- **Trades:** that day's trades. **Tag** a trade with mistakes like *Revenge trade* or *Moved stop*; the
  **Mistakes** box under Performance then shows what each mistake cost for the month or all time.

You can also add P&L by hand there.

## Getting your trades in

As far as I know, The Trading Pit doesn't offer a public API for futures accounts, so trades come in via CSV export
from the platform you trade on:

| Platform | Where to export |
| --- | --- |
| Quantower | Trades / Positions history panel → right-click → Export to CSV |
| NinjaTrader | Account Performance → Trades tab → right-click → Export |
| Tradovate | Reports → Performance → Download CSV |
| ATAS / others | Any trade-history CSV with a date column and a P&L column works |

Click **Import trades** and pick the file. Columns are detected automatically (you can change any of them), and
fees are subtracted when the P&L column isn't already net. Importing the same file again won't create
duplicates, so you can just export your full history each time.

### Commissions

Tradovate's Performance export shows P&L **before** commissions. Set your round-trip commission per contract in
**Settings** and it's subtracted from every imported trade, including ones imported earlier, so a small gross win
that fees turn into a loss shows red.

## Data

Everything is stored in your browser (`localStorage`, with screenshots in IndexedDB). Nothing is uploaded anywhere. Use **Settings → Export backup**
to save a copy or move it to another device; backups include your screenshots.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # CSV parsing + day colouring tests
npm run build    # static site in dist/, deployable to GitHub Pages, Netlify, Vercel…
```

Every push to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

Built with Vite, React and TypeScript.
