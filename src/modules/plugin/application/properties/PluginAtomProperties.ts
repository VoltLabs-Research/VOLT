import { isRecord } from '@/support/type-guards/is-record';

export type AtomScalar = string | number | boolean | null;
export type AtomVector = AtomScalar[];
export type AtomPropertyValue = AtomScalar | AtomVector;
export type AtomId = string | number;

export interface FlatAtomProperties {
    id?: AtomId;
    [key: string]: AtomScalar | AtomId | undefined;
}

export interface AtomProperties {
    id?: AtomId;
    [key: string]: AtomPropertyValue | undefined;
}

export type PerAtomColumnarData = Record<string, AtomPropertyValue[]>;
export type PerAtomProperties = AtomProperties[] | PerAtomColumnarData;

export const normalizeAtomId = (value: AtomId | undefined): number | null => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
};

export const flattenAtomProperties = (row: AtomProperties): FlatAtomProperties => {
    const flattened: FlatAtomProperties = {};

    for (const [key, value] of Object.entries(row)) {
        if (key === 'id' || !Array.isArray(value)) {
            flattened[key] = value as AtomScalar | AtomId | undefined;
            continue;
        }

        for (let index = 0; index < value.length; index++) {
            flattened[`${key}[${index}]`] = value[index];
        }
    }

    return flattened;
};

const isColumnarPerAtomData = (value: unknown): value is PerAtomColumnarData => {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return false;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) {
        return false;
    }

    let expectedLength: number | null = null;
    for (const [, column] of entries) {
        if (!Array.isArray(column)) {
            return false;
        }

        expectedLength ??= column.length;
        if (column.length !== expectedLength) {
            return false;
        }
    }

    return true;
};

export const normalizePerAtomProperties = (
    value: PerAtomProperties | null | undefined
): FlatAtomProperties[] | null => {
    if (Array.isArray(value)) {
        return value
            .filter(isRecord)
            .map((item) => flattenAtomProperties(item as AtomProperties));
    }

    if (!isColumnarPerAtomData(value)) {
        return null;
    }

    const entries = Object.entries(value);
    const rowCount = entries[0][1].length;
    const rows: AtomProperties[] = Array.from({ length: rowCount }, () => ({}));

    for (const [key, column] of entries) {
        for (let index = 0; index < rowCount; index++) {
            rows[index][key] = column[index];
        }
    }

    return rows.map(flattenAtomProperties);
};
