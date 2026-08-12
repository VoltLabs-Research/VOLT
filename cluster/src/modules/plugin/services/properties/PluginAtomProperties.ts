type AtomScalar = string | number | boolean | null;
type AtomVector = AtomScalar[];
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

export interface PerAtomParquetSource {
    filePath: string;
    rowCount: number;
}

export const normalizeAtomId = (value: AtomId | undefined): number | null => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
};

const flattenedRowCache = new WeakMap<AtomProperties, FlatAtomProperties>();

export const flattenAtomProperties = (row: AtomProperties): FlatAtomProperties => {
    const cached = flattenedRowCache.get(row);
    if (cached) return cached;

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

    flattenedRowCache.set(row, flattened);
    return flattened;
};
