'use client';

import { useState, useEffect } from 'react';
import { Entry } from '@/lib/storage';
import EntryCard from './EntryCard';
import EntryModal from './EntryModal';

interface SectionProps {
  type: 'journal' | 'learning' | 'resources';
  title: string;
  description: string;
}

export default function Section({ type, title, description }: SectionProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEntries();
  }, [type]);

  const fetchEntries = async () => {
    try {
      const response = await fetch(`/api/${type}`);
      const data = await response.json();
      setEntries(data);
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (entryData: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (editingEntry) {
        const response = await fetch(`/api/${type}/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData),
        });
        const updatedEntry = await response.json();
        setEntries(entries.map(e => e.id === editingEntry.id ? updatedEntry : e));
      } else {
        const response = await fetch(`/api/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData),
        });
        const newEntry = await response.json();
        setEntries([...entries, newEntry]);
      }
      setIsModalOpen(false);
      setEditingEntry(undefined);
    } catch (error) {
      console.error('Error saving entry:', error);
    }
  };

  const handleEdit = (entry: Entry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await fetch(`/api/${type}/${id}`, { method: 'DELETE' });
      setEntries(entries.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleAddNew = () => {
    setEditingEntry(undefined);
    setIsModalOpen(true);
  };

  const headerAccent = type === 'journal' ? '🧭 Log' : type === 'learning' ? '📚 Plan' : '🗂️ Archive';
  const introTone =
    type === 'journal'
      ? 'Capture trades, reasons, and feelings. Revisit to refine process.'
      : type === 'learning'
        ? 'Set weekly focuses, track progress, and mark breakthroughs.'
        : 'Save links with quick notes and tags for fast retrieval.';

  return (
    <>
      <div className={`panel-header panel-${type}`}>
        <div>
          <p className="eyebrow-alt">{headerAccent}</p>
          <h2>{title}</h2>
          <p>{description}</p>
          <p className="panel-sub">{introTone}</p>
        </div>
        <button className="add-button" onClick={handleAddNew}>
          + Add {type === 'journal' ? 'Journal Entry' : type === 'learning' ? 'Learning Note' : 'Resource'}
        </button>
      </div>
      <div className={`card-grid card-grid-${type}`}>
        {loading ? (
          <p className="loading-message">Loading...</p>
        ) : entries.length === 0 ? (
          <p className="empty-message">
            No {type === 'journal' ? 'journal entries' : type === 'learning' ? 'learning notes' : 'resources'} yet. 
            Click the button above to add your first one!
          </p>
        ) : (
          entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => handleEdit(entry)}
              onDelete={() => handleDelete(entry.id)}
              type={type}
            />
          ))
        )}
      </div>
      <EntryModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEntry(undefined);
        }}
        onSave={handleSave}
        entry={editingEntry}
        type={type}
      />
    </>
  );
}
