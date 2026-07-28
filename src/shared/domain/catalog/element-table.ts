import {
    PERIODIC_TABLE,
    typePaletteColor,
    inferElementFromMass,
    type ElementSymbol
} from '@shared/domain/catalog/periodic-table';

export type ColumnDType = 'i32' | 'f32';

export interface TypedColumn {
    dtype: ColumnDType;
    values: Int32Array | Float32Array;
}

export interface ElementTableEntry {

    type: number;

    symbol: string;

    displayName: string;

    color: [number, number, number];

    radius: number;

    mass: number;

    covalentRadius: number;

    vdwRadius: number;

    maxCoordination: number;
}

const buildElementTableEntry = (
    type: number,
    symbol: ElementSymbol | null,
    mass?: number
): ElementTableEntry => {
    if (symbol) {
        const reference = PERIODIC_TABLE[symbol];
        return {
            type,
            symbol: reference.symbol,
            displayName: reference.name,
            color: [...reference.color] as [number, number, number],
            radius: reference.covalentRadius,
            mass: mass ?? reference.mass,
            covalentRadius: reference.covalentRadius,
            vdwRadius: reference.vdwRadius,
            maxCoordination: reference.maxCoordination
        };
    }

    return {
        type,
        symbol: `Type${type}`,
        displayName: `Type ${type}`,
        color: typePaletteColor(type),
        radius: 1.0,
        mass: mass ?? 0,
        covalentRadius: 1.0,
        vdwRadius: 1.0,
        maxCoordination: 12
    };
};

export const buildElementTable = (input: {
    typeCount: number;
    massesByType?: ReadonlyArray<number>;
    elementHintsByType?: ReadonlyArray<string | null>;
}): ElementTableEntry[] => {
    const table: ElementTableEntry[] = [];
    for (let typeIndex = 0; typeIndex < input.typeCount; typeIndex++) {
        const type = typeIndex + 1;
        const mass = input.massesByType?.[typeIndex];
        const hint = input.elementHintsByType?.[typeIndex] ?? null;
        const symbol = resolveElementSymbol(hint, mass);
        table.push(buildElementTableEntry(type, symbol, mass));
    }
    return table;
};

const ELEMENT_SYMBOL_SET = new Set<string>(Object.keys(PERIODIC_TABLE));

const resolveElementSymbol = (
    hint: string | null,
    mass: number | undefined
): ElementSymbol | null => {
    if (hint) {
        const normalized = hint.trim();
        const canonical = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
        if (ELEMENT_SYMBOL_SET.has(canonical)) return canonical as ElementSymbol;
    }
    if (mass !== undefined && mass > 0) return inferElementFromMass(mass);
    return null;
};
