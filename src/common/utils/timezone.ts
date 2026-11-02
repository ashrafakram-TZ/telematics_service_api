const pad = (value: number, length = 2) => String(Math.abs(value)).padStart(length, '0');

export function toZonedIso(date: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const zonedAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offset = Math.round((zonedAsUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  const sign = offset < 0 ? '-' : '+';

  return (
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}` +
    `.${pad(date.getUTCMilliseconds(), 3)}${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`
  );
}

export function zoneDates(value: unknown, timeZone: string): unknown {
  if (value instanceof Date) return toZonedIso(value, timeZone);
  if (Array.isArray(value)) return value.map((item) => zoneDates(item, timeZone));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, zoneDates(item, timeZone)]));
  }
  return value;
}
