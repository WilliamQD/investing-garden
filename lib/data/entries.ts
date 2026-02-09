import useSWR from 'swr';

import type { Entry } from '@/lib/storage';
import { ApiError, requestJson } from '@/lib/data/client';

export type EntryType = 'journal' | 'learning' | 'resources';

export const fetchEntries = async (type: EntryType) => requestJson<Entry[]>(`/api/${type}`);

export const useEntries = (type: EntryType) => {
  const { data, error, mutate, isLoading } = useSWR(['entries', type], () => fetchEntries(type));
  return {
    entries: data ?? [],
    isLoading,
    errorMessage: error instanceof ApiError ? error.message : '',
    mutate,
  };
};

export const createEntry = async (
  type: EntryType,
  data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>
) =>
  requestJson<Entry>(
    `/api/${type}`,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
    {
      unauthorizedMessage: 'Enter the admin token to add entries.',
      errorMessage: 'Unable to create entry right now.',
    }
  );

export const updateEntry = async (
  type: EntryType,
  id: string,
  data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>
) =>
  requestJson<Entry>(
    `/api/${type}/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
    {
      unauthorizedMessage: 'Enter the admin token to update entries.',
      errorMessage: 'Unable to update entry right now.',
    }
  );

export const deleteEntry = async (type: EntryType, id: string) =>
  requestJson<{ success: boolean }>(
    `/api/${type}/${id}`,
    {
      method: 'DELETE',
    },
    {
      unauthorizedMessage: 'Enter the admin token to delete entries.',
      errorMessage: 'Unable to delete entry right now.',
    }
  );
