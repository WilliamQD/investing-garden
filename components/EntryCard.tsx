'use client';

import { Entry } from '@/lib/storage';

interface EntryCardProps {
  entry: Entry;
  onEdit: () => void;
  onDelete: () => void;
  type: 'journal' | 'learning' | 'resources';
}

export default function EntryCard({ entry, onEdit, onDelete, type }: EntryCardProps) {
  return (
    <article className={`card card-${type}`}>
      <div className="card-header-actions">
        <div className="card-title-wrap">
          <span className="card-chip">
            {type === 'journal' ? 'Trade note' : type === 'learning' ? 'Learning task' : 'Resource'}
          </span>
          <h3>{entry.title}</h3>
        </div>
        <div className="card-actions">
          <button className="action-btn" onClick={onEdit} title="Edit">
            ✏️
          </button>
          <button className="action-btn" onClick={onDelete} title="Delete">
            🗑️
          </button>
        </div>
      </div>
      <p className="card-meta">
        {new Date(entry.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })}
      </p>
      <p className="card-content">{entry.content}</p>
      {entry.url && type === 'resources' && (
        <a href={entry.url} target="_blank" rel="noopener noreferrer" className="card-link">
          <span>↗</span> {entry.url}
        </a>
      )}
      {entry.tags && entry.tags.length > 0 && (
        <ul className="pill-list">
          {entry.tags.map((tag, index) => (
            <li key={index}>{tag}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
