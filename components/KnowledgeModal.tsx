'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Entry } from '@/lib/storage';

type KnowledgeEntry = Entry & { entryType: 'learning' | 'resources' };

interface KnowledgeModalProps {
  isOpen: boolean;
  entry?: KnowledgeEntry;
  onClose: () => void;
  onSave: (payload: { entryType: KnowledgeEntry['entryType']; data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> }) => void;
}

const RESOURCE_TYPES = [
  'Website',
  'Article',
  'Research paper',
  'Online course',
  'Video',
  'Podcast',
  'Book',
  'Tool',
];

export default function KnowledgeModal({ isOpen, entry, onClose, onSave }: KnowledgeModalProps) {
  const [entryType, setEntryType] = useState<KnowledgeEntry['entryType']>('learning');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [sourceType, setSourceType] = useState(RESOURCE_TYPES[0]);
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => {
      setEntryType(entry?.entryType ?? 'learning');
      setTitle(entry?.title || '');
      setContent(entry?.content || '');
      setUrl(entry?.url || '');
      setGoal(entry?.goal || '');
      setNextStep(entry?.nextStep || '');
      setSourceType(entry?.sourceType || RESOURCE_TYPES[0]);
      setTags(entry?.tags?.join(', ') || '');
    }, 0);
  }, [isOpen, entry]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title,
      content,
      ...(entryType === 'resources' && {
        url: url?.trim() || undefined,
        sourceType: sourceType || undefined,
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : undefined,
      }),
      ...(entryType === 'learning' && {
        goal: goal || undefined,
        nextStep: nextStep || undefined,
      }),
    };
    onSave({ entryType, data: payload });
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{entry ? 'Edit' : 'Add'} knowledge item</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="knowledge-type">Entry type</label>
            <select
              id="knowledge-type"
              value={entryType}
              onChange={(e) => setEntryType(e.target.value as KnowledgeEntry['entryType'])}
              disabled={Boolean(entry)}
            >
              <option value="learning">Research note</option>
              <option value="resources">External resource</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="knowledge-title">Title</label>
            <input
              type="text"
              id="knowledge-title"
              placeholder={entryType === 'learning' ? 'Risk parity study' : 'CPI data release'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="knowledge-content">Notes</label>
            <textarea
              id="knowledge-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
            <p className="field-hint">Markdown formatting supported.</p>
            <div className="markdown-preview">
              <p className="preview-label">Preview</p>
              <div className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || '*Start typing to see the preview...*'}
                </ReactMarkdown>
              </div>
            </div>
          </div>

          {entryType === 'learning' && (
            <>
              <div className="form-group">
                <label htmlFor="knowledge-goal">Learning goal</label>
                <input
                  type="text"
                  id="knowledge-goal"
                  placeholder="What are you trying to master?"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="knowledge-next">Next step</label>
                <input
                  type="text"
                  id="knowledge-next"
                  placeholder="Next action or checkpoint"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                />
              </div>
            </>
          )}

          {entryType === 'resources' && (
            <>
              <div className="form-group">
                <label htmlFor="knowledge-url">URL</label>
                <input
                  type="url"
                  id="knowledge-url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="knowledge-source">Resource type</label>
                <select
                  id="knowledge-source"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                >
                  {RESOURCE_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="knowledge-tags">Tags (comma-separated)</label>
                <input
                  type="text"
                  id="knowledge-tags"
                  placeholder="macro, risk, policy"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
