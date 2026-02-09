# Investing Garden

Investing Garden is a clean, industrial workspace for tracking portfolio progress, research notes, and market context in one place.

## Features

- **Dashboard view**: Portfolio snapshot chart + live holdings tracker
- **Holdings watchlist**: Add symbols, bulk import from CSV, and see live prices with recent trendlines
- **Trade journal**: Log trades with rationale, emotion, and outcomes
- **Knowledge hub**: Merge learning notes and external resources into one library
- **Admin-only edits**: Public read access with token-protected write actions
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
- **Auth**: Credential-based admin sign-in with signed HttpOnly session cookies
- **Runtime**: Node.js

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/WilliamQD/investing-garden.git
cd investing-garden
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file with the required secrets:
```bash
POSTGRES_URL=your_postgres_connection_string
ADMIN_CREDENTIALS=[{"username":"owner","password":"a-very-long-password"}]
ADMIN_SESSION_SECRET=long_random_secret_at_least_16_chars
TWELVE_DATA_API_KEY=your_twelve_data_key
```
Use `ADMIN_CREDENTIALS` to define approved editor accounts. `ADMIN_SESSION_SECRET` signs secure admin sessions and must be at least 16 characters.

If you still prefer a single-token setup, set `ADMIN_TOKEN` (legacy fallback) and use username `admin`.

Optional tuning:
```bash
MARKET_CACHE_TTL_SECONDS=180
NEXT_PUBLIC_MARKET_CACHE_TTL_MS=180000
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Admin access

Click the Visitor/Admin pill in the header, enter approved credentials, and sign in. Admin mode unlocks portfolio snapshot entry, holdings edits, and knowledge/journal CRUD.

### Dashboard workflows

- Add daily portfolio snapshots to build the account trajectory chart.
- Add holdings symbols (or paste a CSV list) to monitor live prices and recent price trends.

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

## License

This project is open source and available under the MIT License.

## Disclaimer

Nothing on this website is financial advice. This is a personal learning project for documenting an investing journey with a small amount of capital.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run test
```
