
export const quoteIdentifier = (value: string): string =>
    `"${value.replace(/"/g, '""')}"`;

export const sqlString = (value: string): string =>
    `'${value.replace(/'/g, "''")}'`;
