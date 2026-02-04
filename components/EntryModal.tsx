'use client';

import { useState, useEffect } from 'react';
import { Entry } from '@/lib/storage';

interface EntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  entry?: Entry;
  type: 'journal' | 'learning' | 'resources';
}

export default function EntryModal({ isOpen, onClose, onSave, entry, type }: EntryModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => {
      setTitle(entry?.title || '');
      setContent(entry?.content || '');
      setUrl(entry?.url || '');
      setTags(entry?.tags?.join(', ') || '');
    }, 0);
  }, [isOpen, entry?.title, entry?.content, entry?.url, entry?.tags]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title,
      content,
      url: url || undefined,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    });
    setTitle('');
    setContent('');
    setUrl('');
    setTags('');
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">
            {entry ? 'Edit' : 'Add'} {type === 'journal' ? 'Journal Entry' : type === 'learning' ? 'Learning Note' : 'Resource'}
          </h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="entry-title">Title</label>
            <input
              type="text"
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="entry-content">Content</label>
            <textarea
              id="entry-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>
          
          {type === 'resources' && (
            <div className="form-group">
              <label htmlFor="entry-url">URL (optional)</label>
              <input
                type="url"
                id="entry-url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="entry-tags">Tags (comma-separated)</label>
            <input
              type="text"
              id="entry-tags"
              placeholder="valuation, AI, notes"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
