'use client';

import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Entry } from '@/lib/storage';

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
  const [outcome, setOutcome] = useState('');
  const [emotion, setEmotion] = useState('');
  const [ticker, setTicker] = useState('');
  const [goal, setGoal] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [sourceType, setSourceType] = useState('Article');
  const [tags, setTags] = useState('');
  const titleLabelMap = {
    journal: 'Trade / setup',
    learning: 'Learning focus',
    resources: 'Resource title',
  } as const;
  const titlePlaceholderMap = {
    journal: 'NVDA call spread',
    learning: 'Study semiconductor supply chain',
    resources: 'Nvidia Q4 earnings call',
  } as const;
  const contentLabelMap = {
    journal: 'Trade notes',
    learning: 'Progress notes',
    resources: 'Summary',
  } as const;

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => {
      setTitle(entry?.title || '');
      setContent(entry?.content || '');
      setUrl(entry?.url || '');
      setOutcome(entry?.outcome || '');
      setEmotion(entry?.emotion || '');
      setTicker(entry?.ticker || '');
      setGoal(entry?.goal || '');
      setNextStep(entry?.nextStep || '');
      setSourceType(entry?.sourceType || 'Article');
      setTags(entry?.tags?.join(', ') || '');
    }, 0);
  }, [
    isOpen,
    entry?.title,
    entry?.content,
    entry?.url,
    entry?.outcome,
    entry?.emotion,
    entry?.ticker,
    entry?.goal,
    entry?.nextStep,
    entry?.sourceType,
    entry?.tags,
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const basePayload: { title: string; content: string; tags?: string[] } = {
      title,
      content,
    };

    const payload = {
      ...basePayload,
      ...(type !== 'learning' && {
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
      }),
      ...(type === 'resources' && {
        url: url?.trim() || undefined,
        sourceType: sourceType || undefined,
      }),
      ...(type === 'journal' && {
        outcome: outcome || undefined,
        emotion: emotion || undefined,
        ticker: ticker || undefined,
      }),
      ...(type === 'learning' && {
        goal: goal || undefined,
        nextStep: nextStep || undefined,
      }),
    };

    onSave(payload);
    setTitle('');
    setContent('');
    setUrl('');
    setOutcome('');
    setEmotion('');
    setTicker('');
    setGoal('');
    setNextStep('');
    setSourceType('Article');
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
            <label htmlFor="entry-title">{titleLabelMap[type]}</label>
            <input
              type="text"
              id="entry-title"
              placeholder={titlePlaceholderMap[type]}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="entry-content">{contentLabelMap[type]}</label>
            <textarea
              id="entry-content"
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

          {type === 'journal' && (
            <>
              <div className="form-group">
                <label htmlFor="entry-outcome">Outcome</label>
                <select
                  id="entry-outcome"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  <option value="">Select outcome</option>
                  <option value="Win">Win</option>
                  <option value="Loss">Loss</option>
                  <option value="Flat">Flat</option>
                  <option value="Still open">Still open</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="entry-emotion">Emotional state</label>
                <input
                  type="text"
                  id="entry-emotion"
                  placeholder="Calm, anxious, confident..."
                  value={emotion}
                  onChange={(e) => setEmotion(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="entry-ticker">Ticker (optional)</label>
                <input
                  type="text"
                  id="entry-ticker"
                  placeholder="NVDA, AAPL"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                />
              </div>
            </>
          )}

          {type === 'learning' && (
            <>
              <div className="form-group">
                <label htmlFor="entry-goal">Learning goal</label>
                <input
                  type="text"
                  id="entry-goal"
                  placeholder="What are you trying to master?"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="entry-next-step">Next step</label>
                <input
                  type="text"
                  id="entry-next-step"
                  placeholder="Next action or checkpoint"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                />
              </div>
            </>
          )}
          
          {type === 'resources' && (
            <>
              <div className="form-group">
                <label htmlFor="entry-url">URL</label>
                <input
                  type="url"
                  id="entry-url"
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="entry-source">Source type</label>
                <select
                  id="entry-source"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value)}
                >
                  <option value="Article">Article</option>
                  <option value="Video">Video</option>
                  <option value="Book">Book</option>
                  <option value="Podcast">Podcast</option>
                  <option value="Tool">Tool</option>
                </select>
              </div>
            </>
          )}
          
          {type !== 'learning' && (
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
