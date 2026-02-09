import useSWR from 'swr';

import type { Entry } from '@/lib/storage';
import { ApiError, requestJson } from '@/lib/data/client';

export type KnowledgeEntry = Entry & { entryType: 'learning' | 'resources' };

const mergeEntries = (learning: Entry[], resources: Entry[]): KnowledgeEntry[] =>
  [
    ...learning.map(entry => ({ ...entry, entryType: 'learning' as const })),
    ...resources.map(entry => ({ ...entry, entryType: 'resources' as const })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const fetchKnowledgeEntries = async () => {
  const [learning, resources] = await Promise.all([
    requestJson<Entry[]>('/api/learning'),
    requestJson<Entry[]>('/api/resources'),
  ]);
  return mergeEntries(learning, resources);
};

export const useKnowledgeEntries = () => {
  const { data, error, mutate, isLoading } = useSWR('knowledge-entries', fetchKnowledgeEntries);
  return {
    entries: data ?? [],
    isLoading,
    errorMessage: error instanceof ApiError ? error.message : '',
    mutate,
  };
};

export const createKnowledgeEntry = async (
  entryType: KnowledgeEntry['entryType'],
  data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>
) =>
  requestJson<Entry>(
    `/api/${entryType}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    {
      unauthorizedMessage: 'Enter the admin token to add entries.',
      errorMessage: 'Unable to create entry right now.',
    }
  );

export const updateKnowledgeEntry = async (
  entryType: KnowledgeEntry['entryType'],
  id: string,
  data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>
) =>
  requestJson<Entry>(
    `/api/${entryType}/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    {
      unauthorizedMessage: 'Enter the admin token to update entries.',
      errorMessage: 'Unable to update entry right now.',
    }
  );

export const deleteKnowledgeEntry = async (entryType: KnowledgeEntry['entryType'], id: string) =>
  requestJson<{ success: boolean }>(
    `/api/${entryType}/${id}`,
    {
      method: 'DELETE',
    },
    {
      unauthorizedMessage: 'Enter the admin token to delete entries.',
      errorMessage: 'Unable to delete entry right now.',
    }
  );
