import { newId } from '@/lib/id';

export const HOLIDAY_PRESET_STORAGE_KEY = 'chronoline:holiday-preset';

export interface HolidayPreset {
  id: string;
  name: string;
  holidays: string[];
}

export const THAI_PUBLIC_HOLIDAYS_2026 = [
  '2026-01-01', '2026-02-12', '2026-03-16', '2026-04-06',
  '2026-04-13', '2026-04-14', '2026-04-15', '2026-05-01',
  '2026-05-04', '2026-05-11', '2026-06-03', '2026-07-28',
  '2026-08-12', '2026-10-13', '2026-10-23', '2026-12-05',
  '2026-12-10', '2026-12-31',
];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHolidayPresetName(name: unknown, fallbackIndex: number) {
  if (typeof name === 'string' && name.trim()) {
    return name.trim();
  }

  return `Preset ${fallbackIndex + 1}`;
}

export function createHolidayPreset(input?: Partial<HolidayPreset>): HolidayPreset {
  return {
    id: input?.id ?? newId('hp'),
    name: normalizeHolidayPresetName(input?.name, 0),
    holidays: normalizeHolidayPresetDates(input?.holidays ?? []),
  };
}

export function normalizeHolidayPresetDates(dates: Iterable<unknown>): string[] {
  const normalized = new Set<string>();

  for (const date of dates) {
    if (typeof date !== 'string' || !ISO_DATE_PATTERN.test(date)) continue;
    normalized.add(date);
  }

  return [...normalized].sort((a, b) => a.localeCompare(b));
}

export function normalizeHolidayPresets(presets: Iterable<unknown>): HolidayPreset[] {
  const normalized: HolidayPreset[] = [];
  const seenIds = new Set<string>();

  for (const [index, preset] of Array.from(presets).entries()) {
    if (!preset || typeof preset !== 'object') continue;

    const candidate = preset as Partial<HolidayPreset>;
    const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : newId('hp');
    if (seenIds.has(id)) continue;

    seenIds.add(id);
    normalized.push({
      id,
      name: normalizeHolidayPresetName(candidate.name, index),
      holidays: normalizeHolidayPresetDates(candidate.holidays ?? []),
    });
  }

  return normalized;
}

export function loadHolidayPresets(): HolidayPreset[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(HOLIDAY_PRESET_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    if (parsed.every((value) => typeof value === 'string')) {
      const holidays = normalizeHolidayPresetDates(parsed);
      if (holidays.length === 0) return [];

      return [
        createHolidayPreset({
          name: 'Imported preset',
          holidays,
        }),
      ];
    }

    return normalizeHolidayPresets(parsed);
  } catch {
    return [];
  }
}

export function persistHolidayPresets(presets: Iterable<unknown>): HolidayPreset[] {
  const normalized = normalizeHolidayPresets(presets);

  if (typeof window !== 'undefined') {
    localStorage.setItem(HOLIDAY_PRESET_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}