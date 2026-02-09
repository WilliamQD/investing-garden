'use client';

import { useEffect, useState } from 'react';

import { useAdmin } from '@/lib/admin-client';
import type { Entry } from '@/lib/storage';

import EntryCard from './EntryCard';
import KnowledgeModal from './KnowledgeModal';

type KnowledgeEntry = Entry & { entryType: 'learning' | 'resources' };

export default function KnowledgeSection() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | undefined>();
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedKind, setSelectedKind] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const { hasAdminToken } = useAdmin();

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const [learningResponse, resourceResponse] = await Promise.all([
        fetch('/api/learning'),
        fetch('/api/resources'),
      ]);
      const [learningData, resourceData] = await Promise.all([
        learningResponse.json(),
        resourceResponse.json(),
      ]);
      const merged = [
        ...(Array.isArray(learningData)
          ? learningData.map((entry: Entry) => ({ ...entry, entryType: 'learning' as const }))
          : []),
        ...(Array.isArray(resourceData)
          ? resourceData.map((entry: Entry) => ({ ...entry, entryType: 'resources' as const }))
          : []),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setEntries(merged);
    } catch (error) {
      console.error('Error fetching knowledge entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (payload: { entryType: KnowledgeEntry['entryType']; data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> }) => {
    try {
      if (!hasAdminToken) {
        setAuthMessage('Enter the admin token to save changes.');
        return;
      }
      const targetType = editingEntry?.entryType ?? payload.entryType;
      if (editingEntry) {
        const response = await fetch(`/api/${targetType}/${editingEntry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.data),
          credentials: 'include',
        });
        if (response.status === 401) {
          setAuthMessage('Enter the admin token to update entries.');
          return;
        }
        const updatedEntry = await response.json();
        setEntries(entries.map(entry => entry.id === editingEntry.id ? { ...updatedEntry, entryType: targetType } : entry));
      } else {
        const response = await fetch(`/api/${payload.entryType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload.data),
          credentials: 'include',
        });
        if (response.status === 401) {
          setAuthMessage('Enter the admin token to add entries.');
          return;
        }
        const newEntry = await response.json();
        setEntries([{ ...newEntry, entryType: payload.entryType }, ...entries]);
      }
      setIsModalOpen(false);
      setEditingEntry(undefined);
      setAuthMessage('');
    } catch (error) {
      console.error('Error saving knowledge entry:', error);
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleDelete = async (entry: KnowledgeEntry) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      if (!hasAdminToken) {
        setAuthMessage('Enter the admin token to delete entries.');
        return;
      }
      const response = await fetch(`/api/${entry.entryType}/${entry.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (response.status === 401) {
        setAuthMessage('Enter the admin token to delete entries.');
        return;
      }
      setEntries(entries.filter(item => item.id !== entry.id));
      setAuthMessage('');
    } catch (error) {
      console.error('Error deleting knowledge entry:', error);
    }
  };

  const handleAddNew = () => {
    if (!hasAdminToken) {
      setAuthMessage('Enter the admin token to add new entries.');
      return;
    }
    setEditingEntry(undefined);
    setIsModalOpen(true);
  };

  const allTags = Array.from(
    new Set(entries.flatMap(entry => entry.tags || []))
  ).sort();

  const searchLower = searchText.toLowerCase();
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = !searchText ||
      (entry.title && entry.title.toLowerCase().includes(searchLower)) ||
      (entry.content && entry.content.toLowerCase().includes(searchLower));
    const matchesTag = !selectedTag ||
      (entry.tags && entry.tags.includes(selectedTag));
    const matchesKind = !selectedKind || entry.entryType === selectedKind;
    return matchesSearch && matchesTag && matchesKind;
  });

  return (
    <>
      <div className="panel-header panel-knowledge">
        <div>
          <p className="eyebrow-alt">📚 Knowledge</p>
          <h2>Research & Resources</h2>
          <p>One place for study notes, market reading, and external resources.</p>
          <p className="panel-sub">Capture learnings, tag sources, and revisit what matters.</p>
        </div>
        <button className="add-button" onClick={handleAddNew} disabled={!hasAdminToken}>
          + Add Knowledge Item
        </button>
      </div>
      {!hasAdminToken && (
        <div className="auth-banner">
          Enter the admin token to add, edit, or delete entries. Reading is always available.
        </div>
      )}
      {authMessage && <p className="auth-message">{authMessage}</p>}

      <div className="search-filter-bar">
        <input
          type="text"
          placeholder="Search notes and resources..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="search-input"
        />
        <select
          value={selectedKind}
          onChange={(e) => setSelectedKind(e.target.value)}
          className="tag-filter-select"
        >
          <option value="">All types</option>
          <option value="learning">Research notes</option>
          <option value="resources">Resources</option>
        </select>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="tag-filter-select"
        >
          <option value="">All tags</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
        {(searchText || selectedTag || selectedKind) && (
          <button
            onClick={() => { setSearchText(''); setSelectedTag(''); setSelectedKind(''); }}
            className="clear-filters-btn"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="card-grid card-grid-knowledge">
        {loading ? (
          <p className="loading-message">Loading...</p>
        ) : filteredEntries.length === 0 ? (
          <p className="empty-message">
            {entries.length === 0
              ? 'No knowledge items yet. Click the button above to add your first one!'
              : 'No entries match your search or filter criteria.'}
          </p>
        ) : (
          filteredEntries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onEdit={() => handleEdit(entry)}
              onDelete={() => handleDelete(entry)}
              type={entry.entryType}
              canEdit={hasAdminToken}
            />
          ))
        )}
      </div>
      <KnowledgeModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEntry(undefined);
        }}
        onSave={handleSave}
        entry={editingEntry}
      />
    </>
  );
}
