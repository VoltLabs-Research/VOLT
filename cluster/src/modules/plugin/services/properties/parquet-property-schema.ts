import {
    type AtomProperties,
    type PerAtomColumnarData,
    type PerAtomProperties,
    flattenAtomProperties
} from '@modules/plugin/services/properties/PluginAtomProperties';


type PropertyColumnType = 'double' | 'varchar';

export interface PropertyColumn {
    name: string;
    type: PropertyColumnType;
    sourceName?: string;
    vectorIndex?: number;
}

export const BASE_COLUMNS = new Set(['timestep', 'atom_index', 'id']);

export const toFiniteNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const updateColumnType = (
    columns: Map<string, PropertyColumn>,
    name: string,
    value: unknown,
    sourceName?: string,
    vectorIndex?: number
): void => {
    if (value === undefined) return;

    const current = columns.get(name);
    const nextType: PropertyColumnType = current?.type === 'varchar' || (
        value !== null && toFiniteNumber(value) === null
    )
        ? 'varchar'
        : 'double';

    columns.set(name, {
        name,
        type: nextType,
        sourceName: current?.sourceName ?? sourceName,
        vectorIndex: current?.vectorIndex ?? vectorIndex
    });
};

const sortByName = (columns: Map<string, PropertyColumn>): PropertyColumn[] =>
    Array.from(columns.values()).sort((left, right) => left.name.localeCompare(right.name));

const inferColumnsFromFlatRows = (rows: AtomProperties[]): PropertyColumn[] => {
    const columns = new Map<string, PropertyColumn>();
    for (const row of rows) {
        for (const [key, value] of Object.entries(flattenAtomProperties(row))) {
            if (BASE_COLUMNS.has(key)) continue;
            updateColumnType(columns, key, value);
        }
    }

    return sortByName(columns);
};

const inferColumnsFromColumnarRows = (rows: PerAtomColumnarData): PropertyColumn[] => {
    const columns = new Map<string, PropertyColumn>();
    for (const [sourceName, values] of Object.entries(rows)) {
        if (sourceName === 'id') continue;
        for (const value of values) {
            if (Array.isArray(value)) {
                for (let index = 0; index < value.length; index += 1) {
                    updateColumnType(columns, `${sourceName}[${index}]`, value[index], sourceName, index);
                }
                continue;
            }

            updateColumnType(columns, sourceName, value, sourceName);
        }
    }

    return sortByName(columns);
};

export const getColumnarRowCount = (rows: PerAtomColumnarData): number =>
    Object.values(rows)[0]?.length ?? 0;

export const getRowCount = (rows: PerAtomProperties | null | undefined): number => {
    if (!rows) return 0;
    return Array.isArray(rows) ? rows.length : getColumnarRowCount(rows);
};

export const inferPropertyColumns = (rows: PerAtomProperties): PropertyColumn[] =>
    Array.isArray(rows) ? inferColumnsFromFlatRows(rows) : inferColumnsFromColumnarRows(rows);

export const listPropertyColumnNames = (rows: Record<string, unknown>[]): string[] => {
    if (rows.length === 0) return [];
    return Object.keys(rows[0]).filter((name) => !BASE_COLUMNS.has(name));
};
