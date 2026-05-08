import { isNumberArray } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';
import type { ReactNode } from 'react';

type ResolvedNumberArrayValue =
    | { numbers: number[]; fallback?: never }
    | { numbers?: never; fallback: ReactNode };

export const resolveNumberArrayCellValue = (value: unknown): ResolvedNumberArrayValue => {
    if (!isNumberArray(value)) {
        return { fallback: <span className='plugin-cell-empty'>-</span> };
    }

    if (value.length === 0) {
        return { fallback: <span className='plugin-cell-empty'>[]</span> };
    }

    return { numbers: value };
};
