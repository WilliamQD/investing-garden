# Investing Garden

A personal portfolio tracker for monitoring holdings, logging trades, and organizing investment research in one place.

## Features

- **Live holdings tracker**: Track symbols with real-time prices, company names, 52-week range, cost basis, and gain/loss
- **Trade history**: Log buy/sell trades with automatic average cost basis recalculation (Fidelity-style)
- **Portfolio overview**: Live portfolio value, today's change, total gain/loss, realized P&L from completed trades
- **Cash position**: Track money market / cash balance alongside holdings
- **Journal**: Document trade rationale, emotions, and outcomes with markdown support
- **Knowledge hub**: Organize learning notes and external resources
- **Backup & restore**: Full data export/import (JSON or ZIP) covering journal, knowledge, holdings, trades, settings, and snapshots
- **Owner sessions**: Single-owner authentication with signed HttpOnly session cookies
- **Assistant ingest API**: Machine-authenticated endpoint for Codex-managed notes, resources, and user-reported executed trades
- **Market data**: Twelve Data quotes with server-side caching

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 + custom CSS
- **Storage**: Vercel Postgres (Neon)
- **Auth**: Single-owner credential with HMAC-SHA256 signed sessions
- **Data fetching**: SWR (client), Twelve Data API (market quotes)
- **Signal microservice**: FastAPI (Python) for momentum + RSI scoring (optional)

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/WilliamQD/investing-garden.git
cd investing-garden
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env.local` file with the required secrets:
```bash
POSTGRES_URL=your_postgres_connection_string
ADMIN_USERNAME=owner
ADMIN_PASSWORD=a-very-long-password
ADMIN_SESSION_SECRET=long_random_secret_at_least_16_chars
ASSISTANT_INGEST_TOKEN=long_random_machine_token_at_least_16_chars
TWELVE_DATA_API_KEY=your_twelve_data_key
```
Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` for the single owner account. `ADMIN_SESSION_SECRET` signs secure session cookies and must be at least 16 characters.
Set `ASSISTANT_INGEST_TOKEN` only when enabling Codex-to-site writes. Keep it out of git and configure it separately in Vercel. `IG_ASSISTANT_INGEST_TOKEN` is also accepted for projects that keep the existing `IG_` prefix convention.

Optional tuning:
```bash
MARKET_CACHE_TTL_SECONDS=180
NEXT_PUBLIC_MARKET_CACHE_TTL_MS=180000
MARKET_SIGNAL_SERVICE_URL=http://localhost:8000/v1/signals/momentum
```

4. Run the development server:
```bash
pnpm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
pnpm run build
pnpm start
```

## Usage

### Admin access

Click the Visitor/Owner pill in the header, enter owner credentials, and sign in. Portfolio data, trade history, journal entries, knowledge notes, resources, settings, stats, and backups are owner-only. Sessions expire after 12 hours.

### Assistant ingest

Codex can write selected production data through `POST /api/assistant/ingest` when the request includes `Authorization: Bearer <ASSISTANT_INGEST_TOKEN>`.

Supported v1 actions:
- `trade.create` for user-reported executed trades
- `learning.create` and `learning.upsertByTitle`
- `resource.create`
- `journal.create`
- `settings.cash.adjust`

Every assistant request must include an `idempotencyKey` so retries do not duplicate records.

### Dashboard

- View live portfolio value, today's change, total gain/loss, and realized P&L
- Log trades (buy/sell) — holdings are automatically created and updated via average cost basis
- Review full trade history with inline editing

### Holdings

- Add ticker symbols to track live prices and company names
- View current price, daily change, cost basis, total value, gain/loss, and 52-week range
- Quantities and average cost are computed from trade history
- Track cash/money market position alongside holdings

### Knowledge hub

- Capture research notes and learning goals
- Save external resources with type taxonomy (website, course, research paper, etc.)

### Backup & restore

- Export all data (journal, knowledge, holdings, trades, settings, snapshots) to JSON or ZIP
- Restore from a backup file to repopulate the database

## Project Structure

```
investing-garden/
├── app/
│   ├── api/
│   │   ├── auth/           # login, logout, session
│   │   ├── backup/         # export/restore
│   │   ├── journal/        # journal CRUD
│   │   ├── learning/       # learning notes CRUD
│   │   ├── market/         # quotes, history, signals
│   │   ├── portfolio/
│   │   │   ├── holdings/   # holdings CRUD
│   │   │   ├── snapshots/  # portfolio snapshots
│   │   │   └── trades/     # trade history CRUD
│   │   ├── resources/      # resources CRUD
│   │   ├── settings/       # site settings
│   │   └── stats/          # analytics
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/
│   ├── features/
│   │   ├── dashboard/      # DashboardSection
│   │   ├── holdings/       # HoldingsSection
│   │   └── journal/        # JournalSection
│   ├── AuthControls.tsx
│   ├── BackupRestore.tsx
│   ├── EntryCard.tsx
│   ├── EntryModal.tsx
│   ├── FiftyTwoWeekRange.tsx
│   ├── HoldingCard.tsx
│   ├── KnowledgeModal.tsx
│   ├── KnowledgeSection.tsx
│   ├── MarketPrice.tsx
│   ├── Section.tsx
│   └── TradeHistory.tsx
├── lib/
│   ├── data/               # client-side data hooks (SWR)
│   ├── admin-client.tsx    # admin context provider
│   ├── auth.ts             # session signing, credentials
│   ├── audit.ts            # audit logging
│   ├── logger.ts           # structured logging
│   ├── migrations.js       # database migrations
│   ├── portfolio.ts        # holdings, trades, snapshots, settings
│   ├── rate-limit.ts       # rate limiting
│   ├── storage.ts          # journal/learning/resources storage
│   └── validation.ts       # input validation
├── services/
│   └── signal-engine/      # FastAPI momentum microservice
├── k8s/
│   └── signal-engine/      # Kubernetes deployment
└── public/
```

## API Endpoints

### Auth
- `POST /api/auth/login` — Authenticate with credentials
- `POST /api/auth/logout` — Clear session
- `GET /api/auth/session` — Check session status (with auto-rotation)

### Assistant
- `POST /api/assistant/ingest` — Machine-authenticated Codex ingest endpoint

### Journal
- `GET /api/journal` — List all journal entries
- `POST /api/journal` — Create a new entry
- `GET /api/journal/[id]` — Get a specific entry
- `PUT /api/journal/[id]` — Update an entry
- `DELETE /api/journal/[id]` — Delete an entry

### Knowledge
- `GET /api/learning` — List learning notes
- `POST /api/learning` — Create a learning note
- `PUT /api/learning/[id]` — Update a learning note
- `DELETE /api/learning/[id]` — Delete a learning note
- `GET /api/resources` — List resources
- `POST /api/resources` — Create a resource
- `PUT /api/resources/[id]` — Update a resource
- `DELETE /api/resources/[id]` — Delete a resource

### Portfolio
- `GET /api/portfolio/holdings` — List holdings
- `POST /api/portfolio/holdings` — Track a new symbol
- `PUT /api/portfolio/holdings/[id]` — Update a holding
- `DELETE /api/portfolio/holdings/[id]` — Remove a holding
- `GET /api/portfolio/trades` — List trades
- `POST /api/portfolio/trades` — Log a trade (auto-recalculates holding)
- `PATCH /api/portfolio/trades/[id]` — Edit a trade
- `DELETE /api/portfolio/trades/[id]` — Remove a trade (auto-recalculates holding)
- `GET /api/portfolio/snapshots` — List portfolio snapshots
- `POST /api/portfolio/snapshots` — Record a daily snapshot

### Settings & Data
- `GET /api/settings` — Site settings
- `PUT /api/settings` — Update settings
- `GET /api/stats` — Analytics payload
- `GET /api/backup?format=json|zip` — Export all data
- `POST /api/backup` — Restore from backup file

### Market Data
- `GET /api/market?ticker=MU` — Live price quote (with company name)
- `GET /api/market/history?ticker=MU` — Recent price candles
- `GET /api/market/signal?ticker=MU` — Momentum signal from Python microservice

## Signal Engine Microservice

An optional FastAPI service that computes technical sentiment scores from recent prices.

### Local run

```bash
cd services/signal-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Kubernetes deployment

```bash
docker build -t ghcr.io/<your-org>/investing-garden-signal-engine:latest services/signal-engine
docker push ghcr.io/<your-org>/investing-garden-signal-engine:latest
kubectl apply -f k8s/signal-engine/deployment.yaml
```

## Data Validation

- Tickers: 1-10 characters (letters, numbers, `.` or `-`)
- Trade dates: `YYYY-MM-DD` format
- Resource URLs: must start with `http://` or `https://`
- Backup files: JSON or ZIP, max 5MB

## Quality Checks

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```

## License

This project is open source and available under the MIT License.

## Disclaimer

Nothing on this website is financial advice. This is a personal learning project for documenting an investing journey.
