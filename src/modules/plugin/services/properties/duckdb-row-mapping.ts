import {
    type FlatAtomProperties,
    normalizeAtomId
} from '@modules/plugin/services/properties/PluginAtomProperties';
import type { PluginPropertyType } from '@modules/plugin/services/properties/PluginPropertyStore';
import {
    listPropertyColumnNames,
    toFiniteNumber
} from '@modules/plugin/services/properties/parquet-property-schema';

/** Maps DuckDB result rows, which arrive untyped, into typed atom property shapes. */

const normalizePropertyValue = (value: unknown): string | number | boolean | null | undefined => {
    if (value === null || value === undefined) return value;
    if (typeof value === 'bigint') return Number(value);
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
    return String(value);
};

const readAtomId = (row: Record<string, unknown>): number | null =>
    normalizeAtomId(row.id as string | number | undefined);

const findMaxAtomId = (rows: Record<string, unknown>[]): number => {
    let maxId = 0;
    for (const row of rows) {
        const id = readAtomId(row);
        if (id !== null && id > maxId) maxId = id;
    }
    return maxId;
};

export const toPluginPropertyType = (duckDbColumnType: unknown): PluginPropertyType => {
    const type = String(duckDbColumnType ?? '').toUpperCase();
    return type.includes('CHAR') || type.includes('STRING') || type.includes('TEXT')
        ? 'string'
        : 'number';
};

export const rowsToAtomProperties = (rows: Record<string, unknown>[]): FlatAtomProperties[] => {
    const propertyNames = listPropertyColumnNames(rows);
    return rows.map((row) => {
        const id = readAtomId(row);
        const atom: FlatAtomProperties = id === null ? {} : { id };

        for (const property of propertyNames) {
            atom[property] = normalizePropertyValue(row[property]);
        }

        return atom;
    });
};

/** Builds an atom-id indexed value array, leaving gaps as NaN. */
export const rowsToFloat32ByAtomId = (rows: Record<string, unknown>[]): Float32Array | null => {
    const maxId = findMaxAtomId(rows);
    if (maxId <= 0) return null;

    const values = new Float32Array(maxId + 1);
    values.fill(Number.NaN);
    for (const row of rows) {
        const id = readAtomId(row);
        if (id === null) continue;
        const value = toFiniteNumber(row.value);
        if (value !== null) {
            values[id] = value;
        }
    }

    return values;
};

/** Builds an atom-id indexed value array, leaving gaps as null. */
export const rowsToStringByAtomId = (rows: Record<string, unknown>[]): Array<string | null> => {
    const maxId = findMaxAtomId(rows);
    if (maxId <= 0) return [];

    const values = Array<string | null>(maxId + 1).fill(null);
    for (const row of rows) {
        const id = readAtomId(row);
        if (id === null || row.value === null || row.value === undefined) continue;
        values[id] = String(row.value);
    }

    return values;
};
