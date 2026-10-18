const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** West Africa Time is UTC+1 with no daylight saving. */
const WAT_OFFSET_MS = 60 * 60 * 1000;

export function watToday(now: Date): string {
  return formatDay(new Date(now.getTime() + WAT_OFFSET_MS));
}

export function addCalendarDays(day: string, delta: number): string {
  const parsed = parseDay(day);
  if (!parsed) {
    throw new RangeError('Invalid calendar day');
  }
  const utc = Date.UTC(parsed.year, parsed.month - 1, parsed.day + delta);
  return formatDay(new Date(utc));
}

export function isValidDateInput(value: string): boolean {
  return parseDay(value) !== null;
}

/** Inclusive WAT calendar-day bounds, expressed as UTC instants. */
export function watDayBounds(day: string): { startIso: string; endIso: string } | null {
  const parsed = parseDay(day);
  if (!parsed) {
    return null;
  }
  const startUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day, 0, 0, 0, 0) - WAT_OFFSET_MS;
  const endUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999) - WAT_OFFSET_MS;
  return {
    startIso: new Date(startUtc).toISOString(),
    endIso: new Date(endUtc).toISOString(),
  };
}

export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }
  const shifted = new Date(date.getTime() + WAT_OFFSET_MS);
  const month = MONTHS[shifted.getUTCMonth()] ?? 'Unknown';
  const hours = String(shifted.getUTCHours()).padStart(2, '0');
  const minutes = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${shifted.getUTCDate()} ${month} ${shifted.getUTCFullYear()}, ${hours}:${minutes} WAT`;
}

export function greetingForDate(now: Date, firstName: string): string {
  const shifted = new Date(now.getTime() + WAT_OFFSET_MS);
  const hour = shifted.getUTCHours();
  const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return `${salutation}, ${firstName}`;
}

export function firstNameFrom(accountName: string): string {
  const [name] = accountName.trim().split(/\s+/);
  return name && name.length > 0 ? name : 'there';
}

export function presetDateRange(
  preset: '7d' | '30d' | 'all',
  today: string,
): { from: string | null; to: string | null } {
  if (preset === 'all') {
    return { from: null, to: null };
  }
  const days = preset === '7d' ? 6 : 29;
  return { from: addCalendarDays(today, -days), to: today };
}

function parseDay(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function formatDay(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-${day}`;
}
