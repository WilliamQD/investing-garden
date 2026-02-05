'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Entry } from '@/lib/storage';
import MarketPrice from './MarketPrice';

interface EntryCardProps {
  entry: Entry;
  onEdit: () => void;
  onDelete: () => void;
  type: 'journal' | 'learning' | 'resources';
  canEdit: boolean;
}

export default function EntryCard({
  entry,
  onEdit,
  onDelete,
  type,
  canEdit,
}: EntryCardProps) {
  const detailLabel =
    type === 'journal' ? 'Outcome' : type === 'learning' ? 'Goal' : 'Type';
  const detailValue =
    type === 'journal' ? entry.outcome : type === 'learning' ? entry.goal : entry.sourceType;

  return (
    <article className={`card card-${type}`}>
        <div className="card-header-actions">
          <div className="card-title-wrap">
            <span className="card-chip">
              {type === 'journal' ? 'Trade note' : type === 'learning' ? 'Learning task' : 'Resource'}
            </span>
            <h3>{entry.title}</h3>
          </div>
          {canEdit && (
            <div className="card-actions">
              <button className="action-btn" onClick={onEdit} title="Edit">
                ✏️
              </button>
              <button className="action-btn" onClick={onDelete} title="Delete">
                🗑️
              </button>
            </div>
          )}
      </div>
      <p className="card-meta">
        {new Date(entry.createdAt).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        })}
      </p>
      <div className="card-content markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{entry.content}</ReactMarkdown>
      </div>
      {detailValue && (
        <p className="card-detail">
          <span>{detailLabel}:</span> {detailValue}
        </p>
      )}
      {type === 'journal' && entry.ticker && (
        <p className="card-detail">
          <span>Ticker:</span> {entry.ticker.toUpperCase()}
        </p>
      )}
      {type === 'journal' && entry.emotion && (
        <p className="card-detail">
          <span>Emotion:</span> {entry.emotion}
        </p>
      )}
      {type === 'journal' && entry.ticker && (
        <MarketPrice ticker={entry.ticker} />
      )}
      {type === 'learning' && entry.nextStep && (
        <p className="card-detail">
          <span>Next:</span> {entry.nextStep}
        </p>
      )}
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
