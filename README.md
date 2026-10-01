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

Click a day to write a journal entry, rate how well you followed your plan, see that day's trades or add P&L by hand.

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

Everything is stored in your browser (`localStorage`). Nothing is uploaded anywhere. Use **Settings → Export backup**
to save a copy or move it to another device.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # CSV parsing + day colouring tests
npm run build    # static site in dist/, deployable to GitHub Pages, Netlify, Vercel…
```

Every push to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

Built with Vite, React and TypeScript.
