const CSV_DELIMITER = ',';
const EXCEL_CSV_PREFIX = '\uFEFFsep=,';

const escapeCsv = (value: unknown): string => {
    if (value === null || value === undefined) return '';

    let text: string;
    if (typeof value === 'string') {
        text = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
        text = String(value);
    } else {
        text = JSON.stringify(value);
    }

    if (/[",\r\n\t]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
};

const inferColumns = (rows: Record<string, unknown>[]): string[] => {
    const keys = new Set<string>();
    for (const row of rows) {
        Object.keys(row).forEach((key) => keys.add(key));
    }
    return Array.from(keys);
};

export const toCsvContent = (
    rows: Record<string, unknown>[],
    columns?: string[]
): string => {
    const headers = columns?.length ? columns : inferColumns(rows);
    const lineEnding = '\r\n';

    if (!headers.length) {
        return `${EXCEL_CSV_PREFIX}${lineEnding}`;
    }

    const headerLine = headers.map((header) => escapeCsv(header)).join(CSV_DELIMITER);
    const lines = rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(CSV_DELIMITER));
    const content = [headerLine, ...lines].join(lineEnding);

    return `${EXCEL_CSV_PREFIX}${lineEnding}${content}`;
};
