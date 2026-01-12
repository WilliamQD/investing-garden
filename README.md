# William Zhang's Investing Lab

A public lab notebook for tracking investing journey – documenting trades, learning progress, and curated resources.

## Features

- **Journal & Trades**: Log real and simulated trades with reasoning, tags, and dates
- **Learning Plan**: Track educational progress and study notes
- **Resources**: Curate useful links, courses, and tools with descriptions
- **Full CRUD**: Create, read, update, and delete entries in all sections
- **Data Persistence**: All entries are saved to disk and persist across sessions
- **Modern UI**: Beautiful, responsive design with modal dialogs and smooth interactions

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Custom CSS (migrated from original design)
- **Backend**: Next.js API Routes
- **Storage**: File-based JSON storage
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

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Adding Entries

1. Click the navigation buttons (Journal, Learning, Resources) to switch sections
2. Click the "+ Add [Entry Type]" button in any section
3. Fill in the title, content, and optional tags
4. For resources, you can also add a URL
5. Click "Save" to create the entry

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
│   ├── api/              # API routes for CRUD operations
│   │   ├── journal/
│   │   ├── learning/
│   │   └── resources/
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main page component
├── components/           # React components
│   ├── EntryCard.tsx     # Display card for entries
│   ├── EntryModal.tsx    # Modal for add/edit
│   └── Section.tsx       # Section container with CRUD logic
├── lib/
│   └── storage.ts        # Data persistence layer
├── data/                 # JSON storage (gitignored)
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

## Data Storage

Entries are stored as JSON files in the `data/` directory:
- `data/journal.json`
- `data/learning.json`
- `data/resources.json`

The data directory is gitignored to keep your personal entries private.

## License

This project is open source and available under the MIT License.

## Disclaimer

Nothing on this website is financial advice. This is a personal learning project for documenting an investing journey with a small amount of capital.
