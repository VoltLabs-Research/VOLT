// Per-trajectory element-metadata table + the typed-column dtype contract shared by
// the daemon (in-memory + parquet), the server (wire encode), and the client (decode).
//
// Canonical home so all three runtimes import one definition. Pure types + pure
// derivation helpers; no I/O, no runtime validation.

import {
    PERIODIC_TABLE,
    typePaletteColor,
    inferElementFromMass,
    type ElementSymbol
} from './periodic-table';

/** The dtype subset the daemon infers and carries for custom per-atom columns. */
export type ColumnDType = 'i32' | 'f32';

/** A typed per-atom column: an integer or float view over one property. */
export interface TypedColumn {
    dtype: ColumnDType;
    values: Int32Array | Float32Array;
}

/**
 * One row of a trajectory's element table, keyed by 1-indexed LAMMPS atom type.
 * Derived from the dump's element hints / Masses at ingest, then user-overridable.
 */
export interface ElementTableEntry {
    /** 1-indexed LAMMPS atom type. */
    type: number;
    /** Periodic-table symbol (e.g. "Fe"), or a synthetic label when unknown. */
    symbol: string;
    /** Human-facing label; defaults to the element name or "Type N". */
    displayName: string;
    /** Display color, linear RGB in [0, 1]. */
    color: [number, number, number];
    /** Render radius in Angstrom (covalent radius by default). */
    radius: number;
    /** Atomic mass in u (Da); 0 when unknown. */
    mass: number;
    /** Cordero covalent radius in Angstrom. */
    covalentRadius: number;
    /** Bondi/Alvarez van der Waals radius in Angstrom. */
    vdwRadius: number;
    /** Close-packed default coordination number. */
    maxCoordination: number;
}

/**
 * Build an element-table entry for a LAMMPS type. When `symbol` resolves to a known
 * element, the row is fully populated from the periodic table; otherwise it falls
 * back to the default type palette + a synthetic label (radius defaults to a generic
 * 1.0 Angstrom). `mass` is preserved when supplied even if the symbol is unknown.
 */
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

/**
 * Derive a full element table from per-type masses and/or element hints. Index 0 of
 * each input array is the 1-indexed `type` 1 (LAMMPS types are 1-based; callers pass
 * compact 0-based arrays). An explicit element hint wins; otherwise mass-nearest
 * inference is used; otherwise the type-palette fallback.
 */
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

/** Resolve an element symbol from an explicit hint first, then mass-nearest. */
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
