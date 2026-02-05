# William Zhang's Investing Lab

A public lab notebook for tracking investing journey – documenting trades, learning progress, and curated resources.

## Features

- **Journal & Trades**: Log real and simulated trades with reasoning, tags, and dates
- **Learning Plan**: Track educational progress and study notes
- **Resources**: Curate useful links, courses, and tools with descriptions
- **Full CRUD**: Create, read, update, and delete entries in all sections
- **Postgres Storage**: Persistent cloud database via Vercel Postgres
- **Admin-only edits**: Public read access with token-protected write actions
- **Backups**: Export and restore entries as JSON or ZIP archives
- **Markdown Notes**: Write in Markdown with live preview and rich rendering
- **Analytics**: Stats dashboard with win/loss, heatmap, and tag insights
- **Market Data**: Live prices pulled when a journal ticker is provided
- **Modern UI**: Beautiful, responsive design with modal dialogs and smooth interactions

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Custom CSS (migrated from original design)
- **Backend**: Next.js API Routes
- **Storage**: Vercel Postgres
- **Auth**: Admin token header for write access
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
ADMIN_TOKEN=your_admin_token
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

### Adding Entries

1. Click the navigation buttons (Journal, Learning, Resources) to switch sections
2. Click the "+ Add [Entry Type]" button in any section
3. Fill in the section-specific fields (trade outcome + emotion, learning goals + next steps, or resource URL + type)
4. Add a ticker to journal entries to pull live market prices
5. Use Markdown in notes for formatting (preview is shown live)
6. Add tags for journal/resource entries if desired
7. Click "Save" to create the entry

### Editing Entries

1. Hover over any entry card to reveal the edit (✏️) and delete (🗑️) buttons
2. Click the edit button to modify an entry
3. Make your changes and click "Save"

### Deleting Entries

1. Hover over any entry card
2. Click the delete button (🗑️)
3. Confirm the deletion

## Project Structure

```
investing-garden/
├── app/
  │   ├── api/              # API routes for CRUD, backup, stats
│   │   ├── backup/
│   │   ├── journal/
│   │   ├── learning/
│   │   ├── market/
│   │   ├── resources/
│   │   └── stats/
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Main page component
  │   └── providers.tsx     # Admin token provider
├── components/           # React components
│   ├── AuthControls.tsx  # Login/logout controls
│   ├── EntryCard.tsx     # Display card for entries
│   ├── EntryModal.tsx    # Modal for add/edit
│   ├── MarketPrice.tsx   # Market price display
│   ├── Section.tsx       # Section container with CRUD logic
│   └── StatsPanel.tsx    # Analytics and backup panel
├── lib/
  │   ├── auth.ts           # Admin token validation
│   └── storage.ts        # Postgres persistence layer
└── public/               # Static assets
```

## API Endpoints

All endpoints support JSON payloads:

### Journal
- `GET /api/journal` - List all journal entries
- `POST /api/journal` - Create a new entry
- `GET /api/journal/[id]` - Get a specific entry
- `PUT /api/journal/[id]` - Update an entry
- `DELETE /api/journal/[id]` - Delete an entry

### Learning
- `GET /api/learning` - List all learning notes
- `POST /api/learning` - Create a new note
- `GET /api/learning/[id]` - Get a specific note
- `PUT /api/learning/[id]` - Update a note
- `DELETE /api/learning/[id]` - Delete a note

### Resources
- `GET /api/resources` - List all resources
- `POST /api/resources` - Create a new resource
- `GET /api/resources/[id]` - Get a specific resource
- `PUT /api/resources/[id]` - Update a resource
- `DELETE /api/resources/[id]` - Delete a resource

### Backup & Analytics
- `GET /api/backup?format=json|zip` - Export all data
- `POST /api/backup` - Restore from a backup file
- `GET /api/stats` - Analytics payload for the Stats dashboard

### Market Data
- `GET /api/market?ticker=NVDA` - Live price lookup

## Admin Access

To enable edits, enter the `ADMIN_TOKEN` value in the header token field. All reads remain public.

## Data Storage

Entries are stored in Postgres tables. To migrate older `data/*.json` files, zip the
three JSON files (`journal.json`, `learning.json`, `resources.json`) and restore them
from the Stats → Backup & restore panel.

## License

This project is open source and available under the MIT License.

## Disclaimer

Nothing on this website is financial advice. This is a personal learning project for documenting an investing journey with a small amount of capital.
