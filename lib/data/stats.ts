import useSWR from 'swr';

import { ApiError, requestBlob, requestJson } from '@/lib/data/client';

export type DailyCount = { date: string; count: number };
export type TagCount = { tag: string; count: number };

export interface StatsPayload {
  totals: { journal: number; learning: number; resources: number };
  outcomes: { win: number; loss: number; flat: number; open: number };
  dailyJournal: DailyCount[];
  activity: DailyCount[];
  topTags: TagCount[];
}

const fetchStats = async () => {
  const data = await requestJson<StatsPayload>('/api/stats');
  if (!data?.outcomes) {
    throw new ApiError('Analytics are unavailable. Check your database connection.', 500);
  }
  return data;
};

export const useStats = () => {
  const { data, error, mutate, isLoading } = useSWR('/api/stats', fetchStats);
  return {
    stats: data ?? null,
    isLoading,
    errorMessage: error instanceof ApiError ? error.message : '',
    mutate,
  };
};

export const downloadBackup = async (format: 'json' | 'zip') =>
  requestBlob(`/api/backup?format=${format}`, undefined, {
    unauthorizedMessage: 'Enter the admin token to export backups.',
    errorMessage: 'Backup failed. Check authentication.',
  });

export const restoreBackup = async (formData: FormData) =>
  requestJson<{ success: boolean }>(
    '/api/backup',
    {
      method: 'POST',
      body: formData,
      headers: {},
    },
    {
      unauthorizedMessage: 'Enter the admin token to restore backups.',
      errorMessage: 'Restore failed. Check the file format.',
    }
  );
