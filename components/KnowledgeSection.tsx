'use client';

import { useMemo, useState } from 'react';

import { useAdmin } from '@/lib/admin-client';
import type { Entry } from '@/lib/storage';
import {
  ApiError,
} from '@/lib/data/client';
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  updateKnowledgeEntry,
  useKnowledgeEntries,
  type KnowledgeEntry,
} from '@/lib/data/knowledge';

import EntryCard from './EntryCard';
import KnowledgeModal from './KnowledgeModal';

export default function KnowledgeSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | undefined>();
  const [searchText, setSearchText] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedKind, setSelectedKind] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const { canWrite } = useAdmin();
  const { entries, isLoading, mutate } = useKnowledgeEntries();

  const handleSave = async (payload: { entryType: KnowledgeEntry['entryType']; data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> }) => {
    try {
      const targetType = editingEntry?.entryType ?? payload.entryType;
      if (editingEntry) {
        if (!canWrite) {
          setAuthMessage('Enter the admin token to update entries.');
          return;
        }
        const updatedEntry = await updateKnowledgeEntry(targetType, editingEntry.id, payload.data);
        await mutate(current =>
          (current ?? []).map(entry =>
            entry.id === editingEntry.id ? { ...updatedEntry, entryType: targetType } : entry
          ),
          { revalidate: false }
        );
      } else {
        if (!canWrite) {
          setAuthMessage('Enter the admin token to add entries.');
          return;
        }
        const newEntry = await createKnowledgeEntry(payload.entryType, payload.data);
        await mutate(current => [{ ...newEntry, entryType: payload.entryType }, ...(current ?? [])], {
          revalidate: false,
        });
      }
      setIsModalOpen(false);
      setEditingEntry(undefined);
      setAuthMessage('');
    } catch (error) {
      console.error('Error saving knowledge entry:', error);
      if (error instanceof ApiError) {
        setAuthMessage(error.message);
      }
    }
  };

  const handleEdit = (entry: KnowledgeEntry) => {
    setEditingEntry(entry);
    setIsModalOpen(true);
  };

  const handleDelete = async (entry: KnowledgeEntry) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      if (!canWrite) {
        setAuthMessage('Enter the admin token to delete entries.');
        return;
      }
      await deleteKnowledgeEntry(entry.entryType, entry.id);
      await mutate(current => (current ?? []).filter(item => item.id !== entry.id), {
        revalidate: false,
      });
      setAuthMessage('');
    } catch (error) {
      console.error('Error deleting knowledge entry:', error);
      if (error instanceof ApiError) {
        setAuthMessage(error.message);
      }
    }
  };

  const handleAddNew = () => {
    if (!canWrite) {
      setAuthMessage('Enter the admin token to add new entries.');
      return;
    }
    setEditingEntry(undefined);
    setIsModalOpen(true);
  };

  const allTags = useMemo(() => Array.from(new Set(entries.flatMap(entry => entry.tags || []))).sort(), [entries]);

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
        <button className="add-button" onClick={handleAddNew} disabled={!canWrite}>
          + Add Knowledge Item
        </button>
      </div>
      {!canWrite && (
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
        {isLoading ? (
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
              canEdit={canWrite}
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
