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
  const [outcome, setOutcome] = useState('');
  const [emotion, setEmotion] = useState('');
  const [goal, setGoal] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [sourceType, setSourceType] = useState('Article');
  const [tags, setTags] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTimeout(() => {
      setTitle(entry?.title || '');
      setContent(entry?.content || '');
      setUrl(entry?.url || '');
      setOutcome(entry?.outcome || '');
      setEmotion(entry?.emotion || '');
      setGoal(entry?.goal || '');
      setNextStep(entry?.nextStep || '');
      setSourceType(entry?.sourceType || 'Article');
      setTags(type === 'learning' ? '' : entry?.tags?.join(', ') || '');
    }, 0);
  }, [
    isOpen,
    entry?.title,
    entry?.content,
    entry?.url,
    entry?.outcome,
    entry?.emotion,
    entry?.goal,
    entry?.nextStep,
    entry?.sourceType,
    entry?.tags,
    type,
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const basePayload = {
      title,
      content,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
    };

    onSave({
      ...basePayload,
      ...(type === 'resources' && {
        url: url || undefined,
        sourceType: sourceType || undefined,
      }),
      ...(type === 'journal' && {
        outcome: outcome || undefined,
        emotion: emotion || undefined,
      }),
      ...(type === 'learning' && {
        goal: goal || undefined,
        nextStep: nextStep || undefined,
      }),
    });
    setTitle('');
    setContent('');
    setUrl('');
    setOutcome('');
    setEmotion('');
    setGoal('');
    setNextStep('');
    setSourceType('Article');
    if (type !== 'learning') {
      setTags('');
    }
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
            <label htmlFor="entry-title">
              {type === 'journal' ? 'Trade / setup' : type === 'learning' ? 'Learning focus' : 'Resource title'}
            </label>
            <input
              type="text"
              id="entry-title"
              placeholder={
                type === 'journal'
                  ? 'NVDA call spread'
                  : type === 'learning'
                    ? 'Study semiconductor supply chain'
                    : 'Nvidia Q4 earnings call'
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="entry-content">
              {type === 'journal' ? 'Trade notes' : type === 'learning' ? 'Progress notes' : 'Summary'}
            </label>
            <textarea
              id="entry-content"
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
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
