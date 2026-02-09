import { useEffect, useMemo } from 'react';
import useSWR from 'swr';

import { ApiError, requestJson } from '@/lib/data/client';

export type PortfolioSnapshot = { date: string; value: number };

export type Holding = { id: string; ticker: string; label?: string };

export type SiteSettings = {
  headline: string;
  summary: string;
  focusAreas: string[];
};

const DEFAULT_SETTINGS: SiteSettings = {
  headline: 'Investing Garden',
  summary:
    'A clean, industrial workspace for tracking portfolio moves, market context, and research notes in one place.',
  focusAreas: [],
};

const fetchSettings = async () => requestJson<SiteSettings>('/api/settings');

const fetchSnapshots = async () => requestJson<PortfolioSnapshot[]>('/api/portfolio/snapshots');

const fetchHoldings = async () => requestJson<Holding[]>('/api/portfolio/holdings');

const LOCAL_SNAPSHOT_KEY = 'accountSnapshots';

export const useSiteSettings = () => {
  const { data, error, mutate, isLoading } = useSWR('/api/settings', fetchSettings);
  return {
    settings: data ?? DEFAULT_SETTINGS,
    isLoading,
    errorMessage: error instanceof ApiError ? error.message : '',
    mutate,
  };
};

export const usePortfolioSnapshots = () => {
  const { data, error, mutate, isLoading } = useSWR('/api/portfolio/snapshots', fetchSnapshots);

  useEffect(() => {
    if (data && typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_SNAPSHOT_KEY, JSON.stringify(data));
    }
  }, [data]);

  const cachedSnapshots = useMemo(() => {
    if (!error || data || typeof window === 'undefined') return [];
    const saved = localStorage.getItem(LOCAL_SNAPSHOT_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [data, error]);

  return {
    snapshots: data ?? cachedSnapshots,
    isLoading,
    errorMessage: error ? 'Snapshot history unavailable.' : '',
    mutate,
  };
};

export const useHoldings = () => {
  const { data, error, mutate, isLoading } = useSWR('/api/portfolio/holdings', fetchHoldings);
  return {
    holdings: data ?? [],
    isLoading,
    errorMessage: error ? 'Holdings list unavailable.' : '',
    mutate,
  };
};

export const addSnapshot = async (payload: { date: string; value: number }) =>
  requestJson<PortfolioSnapshot>(
    '/api/portfolio/snapshots',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    {
      unauthorizedMessage: 'Sign in as admin to save snapshots.',
      errorMessage: 'Unable to save snapshot right now.',
    }
  );

export const addHolding = async (payload: { ticker: string; label?: string }) =>
  requestJson<Holding>(
    '/api/portfolio/holdings',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    {
      unauthorizedMessage: 'Sign in as admin to add holdings.',
      errorMessage: 'Unable to add holding right now.',
    }
  );

export const importHoldings = async (payload: { holdings: { ticker: string; label?: string }[] }) =>
  requestJson<{ holdings: Holding[]; skipped: number }>(
    '/api/portfolio/holdings',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    {
      unauthorizedMessage: 'Sign in as admin to import holdings.',
      errorMessage: 'Unable to import holdings right now.',
    }
  );

export const removeHolding = async (id: string) =>
  requestJson<{ success: boolean }>(
    `/api/portfolio/holdings/${id}`,
    {
      method: 'DELETE',
    },
    {
      unauthorizedMessage: 'Sign in as admin to remove holdings.',
      errorMessage: 'Unable to remove holding right now.',
    }
  );

export const updateHoldingLabel = async (payload: { id: string; label: string }) =>
  requestJson<Holding>(
    `/api/portfolio/holdings/${payload.id}`,
    {
      method: 'PUT',
      body: JSON.stringify({ label: payload.label }),
    },
    {
      unauthorizedMessage: 'Sign in as admin to update holding labels.',
      errorMessage: 'Unable to update holding label right now.',
    }
  );

export const updateSettings = async (settings: SiteSettings) =>
  requestJson<SiteSettings>(
    '/api/settings',
    {
      method: 'PUT',
      body: JSON.stringify(settings),
    },
    {
      unauthorizedMessage: 'Sign in as admin to update overview settings.',
      errorMessage: 'Unable to update overview right now.',
    }
  );

export const useSortedSnapshots = (snapshots: PortfolioSnapshot[]) =>
  useMemo(() => {
    const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
    if (!sorted.length) return [];
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    const lastRecorded = new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`);
    if (lastRecorded < today) {
      const filler: PortfolioSnapshot[] = [];
      const lastValue = sorted[sorted.length - 1].value;
      const cursor = new Date(lastRecorded);
      cursor.setDate(cursor.getDate() + 1);
      while (cursor <= today) {
        filler.push({ date: cursor.toISOString().slice(0, 10), value: lastValue });
        cursor.setDate(cursor.getDate() + 1);
      }
      return [...sorted, ...filler];
    }
    return sorted;
  }, [snapshots]);
