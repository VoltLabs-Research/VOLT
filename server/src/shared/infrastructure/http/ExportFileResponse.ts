import { Response } from 'express';
import { Readable } from 'stream';
import { ExportType } from '@shared/domain/ports/IBaseRepository';

const escapeCsv = (value: unknown): string => {
    if (value === null || value === undefined) return '';

    const text = typeof value === 'string'
        ? value
        : typeof value === 'number' || typeof value === 'boolean'
            ? String(value)
            : JSON.stringify(value);

    const normalized = text.replace(/\r?\n/g, ' ');
    if (/[",]/.test(normalized)) {
        return `"${normalized.replace(/"/g, '""')}"`;
    }

    return normalized;
};

const inferColumns = (rows: Record<string, unknown>[]): string[] => {
    const keys = new Set<string>();
    for (const row of rows) {
        Object.keys(row).forEach((key) => keys.add(key));
    }
    return Array.from(keys);
};

const toCsv = (rows: Record<string, unknown>[], columns?: string[]): string => {
    const headers = columns?.length ? columns : inferColumns(rows);
    if (!headers.length) {
        return '';
    }

    const headerLine = headers.map((header) => escapeCsv(header)).join(',');
    const lines = rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','));

    return [headerLine, ...lines].join('\n');
};

interface SendExportFileParams {
    res: Response;
    filename: string;
    format: ExportType;
    rows: Record<string, unknown>[];
    columns?: string[];
};

export const sendExportFile = ({
    res,
    filename,
    format,
    rows,
    columns
}: SendExportFileParams): void => {
    const safeBaseName = (filename || 'export').replace(/[^a-zA-Z0-9-_]/g, '_');

    if (format === 'csv') {
        const content = toCsv(rows, columns);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeBaseName}.csv"`);
        Readable.from([content]).pipe(res);
        return;
    }

    const content = JSON.stringify(rows, null, 2);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeBaseName}.json"`);
    Readable.from([content]).pipe(res);
};

export default sendExportFile;
