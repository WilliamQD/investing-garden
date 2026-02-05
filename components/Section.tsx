'use client';

import { useState, useEffect } from 'react';
import { useAdmin } from '@/lib/admin-client';

import type { Entry } from '@/lib/storage';
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
  const [searchText, setSearchText] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [authMessage, setAuthMessage] = useState('');
  const { token, isAdmin } = useAdmin();

  useEffect(() => {
    fetchEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!isAdmin) {
        setAuthMessage('Enter the admin token to save changes.');
        return;
      }
      const adminHeaders: Record<string, string> = token ? { 'x-admin-token': token } : {};
      if (editingEntry) {
        const response = await fetch(`/api/${type}/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...adminHeaders },
          body: JSON.stringify(entryData),
          credentials: 'include',
        });
        if (response.status === 401) {
          setAuthMessage('Enter the admin token to update entries.');
          return;
        }
        const updatedEntry = await response.json();
        setEntries(entries.map(e => e.id === editingEntry.id ? updatedEntry : e));
      } else {
        const response = await fetch(`/api/${type}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...adminHeaders },
          body: JSON.stringify(entryData),
          credentials: 'include',
        });
        if (response.status === 401) {
          setAuthMessage('Enter the admin token to add entries.');
          return;
        }
        const newEntry = await response.json();
        setEntries([...entries, newEntry]);
      }
      setIsModalOpen(false);
      setEditingEntry(undefined);
      setAuthMessage('');
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
      if (!isAdmin) {
        setAuthMessage('Enter the admin token to delete entries.');
        return;
      }
      const adminHeaders: Record<string, string> = token ? { 'x-admin-token': token } : {};
      const response = await fetch(`/api/${type}/${id}`, {
        method: 'DELETE',
        headers: adminHeaders,
        credentials: 'include',
      });
      if (response.status === 401) {
        setAuthMessage('Enter the admin token to delete entries.');
        return;
      }
      setEntries(entries.filter(e => e.id !== id));
      setAuthMessage('');
    } catch (error) {
      console.error('Error deleting entry:', error);
    }
  };

  const handleAddNew = () => {
    if (!isAdmin) {
      setAuthMessage('Enter the admin token to add new entries.');
      return;
    }
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

  // Get all unique tags from entries
  const allTags = Array.from(
    new Set(entries.flatMap(entry => entry.tags || []))
  ).sort();

  // Filter entries based on search text and selected tag
  const searchLower = searchText.toLowerCase();
  const filteredEntries = entries.filter(entry => {
    // Text search filter
    const matchesSearch = !searchText || 
      (entry.title && entry.title.toLowerCase().includes(searchLower)) ||
      (entry.content && entry.content.toLowerCase().includes(searchLower));
    
    // Tag filter
    const matchesTag = !selectedTag || 
      (entry.tags && entry.tags.includes(selectedTag));
    
    return matchesSearch && matchesTag;
  });

  return (
    <>
      <div className={`panel-header panel-${type}`}>
        <div>
          <p className="eyebrow-alt">{headerAccent}</p>
          <h2>{title}</h2>
          <p>{description}</p>
          <p className="panel-sub">{introTone}</p>
        </div>
        <button className="add-button" onClick={handleAddNew} disabled={!isAdmin}>
          + Add {type === 'journal' ? 'Journal Entry' : type === 'learning' ? 'Learning Note' : 'Resource'}
        </button>
      </div>
      {!isAdmin && (
        <div className="auth-banner">
          Enter the admin token to add, edit, or delete entries. Reading is always available.
        </div>
      )}
      {authMessage && <p className="auth-message">{authMessage}</p>}
      
      <div className="search-filter-bar">
        <input
          type="text"
          placeholder="Search entries..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="search-input"
        />
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="tag-filter-select"
        >
          <option value="">All Tags</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
        {(searchText || selectedTag) && (
          <button 
            onClick={() => { setSearchText(''); setSelectedTag(''); }}
            className="clear-filters-btn"
          >
            Clear Filters
          </button>
        )}
      </div>
      
      <div className={`card-grid card-grid-${type}`}>
        {loading ? (
          <p className="loading-message">Loading...</p>
        ) : filteredEntries.length === 0 ? (
          <p className="empty-message">
            {entries.length === 0 
              ? `No ${type === 'journal' ? 'journal entries' : type === 'learning' ? 'learning notes' : 'resources'} yet. Click the button above to add your first one!`
              : 'No entries match your search or filter criteria.'}
          </p>
        ) : (
          filteredEntries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => handleEdit(entry)}
              onDelete={() => handleDelete(entry.id)}
              type={type}
              canEdit={isAdmin}
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
