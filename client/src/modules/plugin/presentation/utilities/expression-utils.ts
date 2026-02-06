import { formatDistanceToNow } from 'date-fns';
import { getValueByPath } from '@/shared/utils/format';

export type ColumnDef = {
    path: string;
    label: string;
};

export const formatCellValue = (value: any, path: string): string => {
    if (value === null || value === undefined) {
        return '-';
    }

    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? value.toLocaleString()
            : Number(value).toFixed(4).replace(/\.?0+$/, '');
    }

    if (typeof value === 'string') {
        if (path.toLowerCase().includes('createdat') || path.toLowerCase().endsWith('date')) {
            try {
                return formatDistanceToNow(new Date(value), { addSuffix: true });
            } catch {
                return value;
            }
        }
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((v) => formatCellValue(v, path)).join(', ');
    }

    if (typeof value === 'object') {
        if ('name' in value && typeof (value as any).name === 'string') {
            return String((value as any).name);
        }
        return JSON.stringify(value);
    }

    return String(value);
};

export const normalizeRows = (rows: any[], columns: ColumnDef[]) => {
    return rows.map((row) => {
        const enriched = { ...row };
        columns.forEach((col) => {
            const { path, label } = col;
            let resolved = getValueByPath(row, path);

            if (resolved === undefined && label) {
                resolved = getValueByPath(row, label);
            }

            enriched[path] = formatCellValue(resolved, path);
        });

        if (!enriched._id) {
            enriched._id = row.timestep ?? row._objectKey ?? `row-${Math.random().toString(36).slice(2)}`;
        }
        return enriched;
    });
};
