import { isRecord } from '@/shared/utils/type-guards';
import type { ReactNode } from 'react';

const ACRONYMS = new Set(['id', 'url', 'api', 'ui', 'sdk', 'rdf', 'rms', 'pbc', 'xyz']);

const MAX_INLINE_STRING = 40;
const MAX_INLINE_NUMBER_ARRAY = 4;
const MAX_INLINE_STRING_ARRAY = 6;

export interface ConfigRow {
    label: string;
    value: ReactNode;
}

export interface ConfigColumn {
    key: string;
    title: string;
    rows: ConfigRow[];
}

export const humanizeKey = (key: string): string => {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);

    if (words.length === 0) return key;

    return words
        .map((word, index) => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) return lower.toUpperCase();
            if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
            return lower;
        })
        .join(' ');
};

const formatNumber = (value: number): string => {
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(3);
};

export const plainValue = (node: ReactNode): ReactNode => <span>{node}</span>;

export const monoValue = (node: ReactNode): ReactNode => (
    <span className='font-mono tabular-nums'>{node}</span>
);

export const emptyValue = (): ReactNode => plainValue(<span className='text-muted'>—</span>);

const renderValue = (value: unknown): ReactNode => {
    if (value === null || value === undefined || value === '') return emptyValue();
    if (typeof value === 'boolean') return plainValue(value ? 'Yes' : 'No');
    if (typeof value === 'number') return monoValue(formatNumber(value));

    if (typeof value === 'string') {
        if (value.length <= MAX_INLINE_STRING) return plainValue(value);
        return plainValue(<span className='truncate' title={value}>{value}</span>);
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return emptyValue();

        if (value.every((item) => typeof item === 'number')) {
            const numbers = value as number[];
            const full = `[${numbers.map(formatNumber).join(', ')}]`;
            if (numbers.length <= MAX_INLINE_NUMBER_ARRAY) return monoValue(full);

            const preview = numbers.slice(0, MAX_INLINE_NUMBER_ARRAY).map(formatNumber).join(', ');
            return monoValue(<span title={full}>{`[${preview}, … ${numbers.length} values]`}</span>);
        }

        if (value.every((item) => typeof item === 'string')) {
            const strings = value as string[];
            const joined = strings.join(', ');
            if (strings.length <= MAX_INLINE_STRING_ARRAY && joined.length <= MAX_INLINE_STRING) {
                return plainValue(joined);
            }
            return plainValue(`${strings.length} items`);
        }

        return plainValue(`${value.length} items`);
    }

    if (isRecord(value)) {
        const count = Object.keys(value).length;
        return count === 0 ? emptyValue() : plainValue(`${count} fields`);
    }

    return plainValue(String(value));
};

export const toConfigRows = (source: Record<string, unknown>): ConfigRow[] => {
    return Object.entries(source).map(([key, value]) => ({
        label: humanizeKey(key),
        value: renderValue(value)
    }));
};

