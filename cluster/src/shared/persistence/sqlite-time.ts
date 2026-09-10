const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

export const toSqliteDateTime = (date: Date): string =>
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    + ` ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;

export const sqliteNow = (): string => toSqliteDateTime(new Date());

export const sqliteDateTimeFromNow = (offsetMs: number): string => toSqliteDateTime(new Date(Date.now() + offsetMs));

export const fromSqliteDateTime = (value: string | Date | null | undefined): Date | null => {
    if (value === null || value === undefined) {
        return null;
    }

    if (value instanceof Date) {
        return value;
    }

    return new Date(`${value.replace(' ', 'T')}Z`);
};
