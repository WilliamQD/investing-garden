import 'server-only';

import type { SiteSettings } from '@/lib/portfolio';
import type { Entry, EntryType } from '@/lib/storage';

const MAX_TITLE_LENGTH = 120;
const MAX_CONTENT_LENGTH = 5000;
const MAX_TEXT_LENGTH = 200;
const MAX_URL_LENGTH = 2048;
const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 24;
const MAX_TICKER_LENGTH = 10;
const MAX_LABEL_LENGTH = 60;
const MAX_ID_LENGTH = 128;
const MAX_SETTINGS_HEADLINE = 80;
const MAX_SETTINGS_SUMMARY = 280;
const MAX_FOCUS_AREAS = 6;
const MAX_FOCUS_AREA_LENGTH = 24;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TICKER_PATTERN = /^[A-Z0-9.-]+$/;

const normalizeRequiredText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
};

export const normalizeOptionalText = (
  value: unknown,
  maxLength: number
): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) return trimmed.slice(0, maxLength);
  return trimmed;
};

export const normalizeTags = (value: unknown): string[] | undefined => {
  if (!value) return undefined;
  const rawTags = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  if (!rawTags.length) return undefined;
  const unique = new Set<string>();
  for (const tag of rawTags) {
    if (unique.size >= MAX_TAGS) break;
    if (typeof tag !== 'string') continue;
    const trimmed = tag.trim();
    if (!trimmed) continue;
    unique.add(trimmed.length > MAX_TAG_LENGTH ? trimmed.slice(0, MAX_TAG_LENGTH) : trimmed);
  }
  return unique.size ? Array.from(unique) : undefined;
};

export const normalizeUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

export const normalizeTicker = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed.length > MAX_TICKER_LENGTH) return undefined;
  if (!TICKER_PATTERN.test(trimmed)) return undefined;
  return trimmed;
};

export const normalizeLabel = (value: unknown): string | undefined =>
  normalizeOptionalText(value, MAX_LABEL_LENGTH);

export const normalizeIsoDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return value;
};

const normalizeTimestamp = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

export type EntryInput = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>;

export const normalizeEntryInput = (
  type: EntryType,
  payload: Record<string, unknown>
): { data?: EntryInput; error?: string } => {
  const title = normalizeRequiredText(payload.title, MAX_TITLE_LENGTH);
  const content = normalizeRequiredText(payload.content, MAX_CONTENT_LENGTH);
  if (!title || !content) {
    return {
      error: type === 'resources'
        ? 'Title, content, and URL are required'
        : 'Title and content are required',
    };
  }

  if (type === 'resources') {
    const rawUrl = typeof payload.url === 'string' ? payload.url.trim() : '';
    if (!rawUrl) {
      return { error: 'Title, content, and URL are required' };
    }
    const url = normalizeUrl(rawUrl);
    if (!url) {
      return { error: 'URL must start with http:// or https://' };
    }
    return {
      data: {
        title,
        content,
        url,
        sourceType: normalizeOptionalText(payload.sourceType, MAX_TEXT_LENGTH),
        tags: normalizeTags(payload.tags),
      },
    };
  }

  if (type === 'learning') {
    return {
      data: {
        title,
        content,
        goal: normalizeOptionalText(payload.goal, MAX_TEXT_LENGTH),
        nextStep: normalizeOptionalText(payload.nextStep, MAX_TEXT_LENGTH),
      },
    };
  }

  return {
    data: {
      title,
      content,
      outcome: normalizeOptionalText(payload.outcome, MAX_TEXT_LENGTH),
      emotion: normalizeOptionalText(payload.emotion, MAX_TEXT_LENGTH),
      tags: normalizeTags(payload.tags),
      ticker: normalizeTicker(payload.ticker),
    },
  };
};

export const normalizeBackupEntry = (type: EntryType, entry: unknown): Entry | null => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const dataResult = normalizeEntryInput(type, entry as Record<string, unknown>);
  if (!dataResult.data) return null;
  const idValue = typeof (entry as Entry).id === 'string' ? (entry as Entry).id.trim() : '';
  if (idValue && idValue.length > MAX_ID_LENGTH) return null;
  const createdAt = normalizeTimestamp((entry as Entry).createdAt) ?? new Date().toISOString();
  const updatedAt = normalizeTimestamp((entry as Entry).updatedAt) ?? createdAt;
  return {
    id: idValue,
    createdAt,
    updatedAt,
    ...dataResult.data,
  };
};

export const normalizeSettingsInput = (
  payload: Record<string, unknown>
): { data?: SiteSettings; error?: string } => {
  const headline = normalizeRequiredText(payload.headline, MAX_SETTINGS_HEADLINE);
  const summary = normalizeRequiredText(payload.summary, MAX_SETTINGS_SUMMARY);
  if (!headline || !summary) {
    return { error: 'Headline and summary are required.' };
  }
  const focusAreasInput = Array.isArray(payload.focusAreas) ? payload.focusAreas : [];
  const focusAreas: string[] = [];
  for (const area of focusAreasInput) {
    if (focusAreas.length >= MAX_FOCUS_AREAS) {
      return { error: `Cannot exceed ${MAX_FOCUS_AREAS} focus areas.` };
    }
    if (typeof area !== 'string') continue;
    const trimmed = area.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_FOCUS_AREA_LENGTH) {
      return { error: `Focus areas must be ${MAX_FOCUS_AREA_LENGTH} characters or fewer.` };
    }
    focusAreas.push(trimmed);
  }
  return {
    data: {
      headline,
      summary,
      focusAreas,
    },
  };
};
