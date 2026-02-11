# Investing Garden

Investing Garden is a clean, industrial workspace for tracking portfolio progress, research notes, and market context in one place.

## Features

- **Dashboard view**: Portfolio snapshot chart + live holdings tracker
- **Holdings watchlist**: Track symbols, quantities, cost basis, and live prices with recent trendlines
- **Trade journal**: Log trades with rationale, emotion, and outcomes
- **Knowledge hub**: Merge learning notes and external resources into one library
- **Admin-only edits**: Public read access with role-aware, session-based write actions
- **Persistent storage**: Postgres (Neon/Vercel Postgres) for all entries and portfolio snapshots
- **Backups + analytics**: Export/restore JSON or ZIP archives and view activity stats
- **Markdown notes**: Markdown support with live preview
- **Market data**: Twelve Data quotes + candles with caching to stay within free limits

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Custom CSS
- **Backend**: Next.js API Routes
- **Storage**: Vercel Postgres / Neon
- **Auth**: Auth.js OIDC (optional) with credential-based fallback and signed HttpOnly sessions
- **Runtime**: Node.js
- **Signal microservice**: FastAPI (Python) for momentum + RSI scoring

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
ADMIN_CREDENTIALS=[{"username":"owner","password":"a-very-long-password","role":"admin"}]
ADMIN_SESSION_SECRET=long_random_secret_at_least_16_chars
TWELVE_DATA_API_KEY=your_twelve_data_key
```
Use `ADMIN_CREDENTIALS` to define approved editor accounts (roles: `admin`, `editor`, `viewer`). `ADMIN_SESSION_SECRET` signs secure admin sessions and must be at least 16 characters.

If you still prefer a single-token setup, set `ADMIN_TOKEN` (legacy fallback) and use username `admin`.

Optional tuning:
```bash
MARKET_CACHE_TTL_SECONDS=180
NEXT_PUBLIC_MARKET_CACHE_TTL_MS=180000
MARKET_SIGNAL_SERVICE_URL=http://localhost:8000/v1/signals/momentum
```

Optional Auth.js (OIDC) configuration:
```bash
OIDC_ISSUER=https://example-issuer.com
OIDC_CLIENT_ID=your_client_id
OIDC_CLIENT_SECRET=your_client_secret
NEXTAUTH_SECRET=long_random_secret_at_least_16_chars
NEXTAUTH_URL=https://your-domain.com/api/oidc
OIDC_ROLE_CLAIM=roles
OIDC_ADMIN_ROLES=admin
OIDC_EDITOR_ROLES=editor
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

Click the Visitor/Admin pill in the header, enter approved credentials or use SSO, and sign in. Admin mode unlocks portfolio snapshot entry, holdings edits, and knowledge/journal CRUD.

### Dashboard workflows

- Add daily portfolio snapshots to build the account trajectory chart.
- Add holdings symbols (or paste a CSV list) with optional quantities and cost basis to monitor live prices and gains.

### Knowledge hub

- Capture research notes and learning goals.
- Save external resources with type taxonomy (website, course, research paper, etc.).

### Data validation notes

- Portfolio snapshots require a `YYYY-MM-DD` date and a non-negative numeric value.
- Holdings tickers accept 1-10 characters (letters, numbers, `.` or `-`).
- Resource URLs must start with `http://` or `https://`.
- Backup restores accept JSON or ZIP files up to 5MB.

## Project Structure

```
investing-garden/
├── app/
│   ├── api/
│   │   ├── backup/
│   │   ├── journal/
│   │   ├── learning/
│   │   ├── market/
│   │   │   └── history/
│   │   ├── portfolio/
│   │   │   ├── holdings/
│   │   │   └── snapshots/
│   │   ├── resources/
│   │   ├── settings/
│   │   └── stats/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/
│   ├── AuthControls.tsx
│   ├── EntryCard.tsx
│   ├── EntryModal.tsx
│   ├── HoldingCard.tsx
│   ├── KnowledgeModal.tsx
│   ├── KnowledgeSection.tsx
│   ├── MarketPrice.tsx
│   ├── MarketSparkline.tsx
│   ├── Section.tsx
│   └── StatsPanel.tsx
├── lib/
│   ├── admin-client.tsx
│   ├── auth.ts
│   ├── portfolio.ts
│   └── storage.ts
└── public/
```

## API Endpoints

All endpoints support JSON payloads:

### Journal
- `GET /api/journal` - List all journal entries
- `POST /api/journal` - Create a new entry
- `GET /api/journal/[id]` - Get a specific entry
- `PUT /api/journal/[id]` - Update an entry
- `DELETE /api/journal/[id]` - Delete an entry

### Knowledge (learning + resources)
- `GET /api/learning` - List learning notes
- `POST /api/learning` - Create a learning note
- `GET /api/resources` - List resources
- `POST /api/resources` - Create a resource

### Portfolio
- `GET /api/portfolio/snapshots` - List portfolio snapshots
- `POST /api/portfolio/snapshots` - Create/update a daily snapshot
- `GET /api/portfolio/holdings` - List holdings
- `POST /api/portfolio/holdings` - Add a holding
- `DELETE /api/portfolio/holdings/[id]` - Remove a holding

### Settings + Analytics
- `GET /api/settings` - Site overview settings
- `PUT /api/settings` - Update overview settings
- `GET /api/stats` - Analytics payload for the Stats dashboard
- `GET /api/backup?format=json|zip` - Export all data
- `POST /api/backup` - Restore from a backup file

### Market Data
- `GET /api/market?ticker=NVDA` - Live price lookup
- `GET /api/market/history?ticker=NVDA` - Recent price candles
- `GET /api/market/signal?ticker=NVDA` - Momentum signal from the Python microservice


## Python Signal Engine Microservice

A good service to add is a **Signal Engine** that computes a fast technical sentiment score from recent prices.

### Why this service

- Isolated compute logic (easy to iterate independently from the Next.js app)
- Reusable for dashboards, alerts, and future bots
- Lightweight enough to autoscale independently

### Local service run

```bash
cd services/signal-engine
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Kubernetes deployment

Build and push your image, then deploy:

```bash
docker build -t ghcr.io/<your-org>/investing-garden-signal-engine:latest services/signal-engine
docker push ghcr.io/<your-org>/investing-garden-signal-engine:latest
kubectl apply -f k8s/signal-engine/deployment.yaml
```

In cluster, the app route can call:

```
http://signal-engine.default.svc.cluster.local:8000/v1/signals/momentum
```

## License

This project is open source and available under the MIT License.

## Disclaimer

Nothing on this website is financial advice. This is a personal learning project for documenting an investing journey with a small amount of capital.

## Quality checks

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
```
