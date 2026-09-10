const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

export const toSqliteDateTime = (date: Date): string =>
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    + ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;

export const sqliteNow = (): string => toSqliteDateTime(new Date());

export const toSqliteDateTimeOrNull = (date: Date | null): string | null => (date ? toSqliteDateTime(date) : null);
