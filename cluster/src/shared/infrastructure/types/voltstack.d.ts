declare module '@voltstack/lammps-io' {
    type Vec3 = [number, number, number];
    type AtomIdArray = Float32Array | Float64Array | Int32Array | Uint32Array | Uint16Array;

    /** Matches the shared ColumnDType union — the daemon maps these onto typed arrays. */
    type ColumnDtype = 'i32' | 'f32';

    export interface NativeParseResult {
        metadata: {
            timestep: number;
            natoms: number;
            boxBounds: { xlo: number; xhi: number; ylo: number; yhi: number; zlo: number; zhi: number };
            headers: string[];
        };
        positions: Float32Array;
        types: Uint16Array;
        ids?: AtomIdArray;
        properties?: Record<string, Int32Array | Float32Array | Float64Array>;
        /** Parallel to `properties`: how each extra column was formatted in the file. */
        propertyDtypes?: Record<string, ColumnDtype>;
        min: Vec3;
        max: Vec3;
        /** Data files only. 1-indexed by LAMMPS type, so index 0 holds type 1. */
        massesByType?: number[];
        /** Data files only. The trailing `# <symbol>` comment on each Masses row. */
        elementHintsByType?: (string | null)[];
    }

    export interface NativeParseOptions {
        includeIds?: boolean;
        /** Extra per-atom columns to extract. `['*']` requests every non-base column. */
        properties?: string[];
    }

    export const dumpParser: {
        parseDump(filePath: string, options: NativeParseOptions): NativeParseResult | null;
    };

    export const dataParser: {
        parseData(filePath: string, options: Pick<NativeParseOptions, 'includeIds'>): NativeParseResult | null;
    };
}
declare module '@voltstack/spatial-assembler';
declare module '@voltstack/headless-rasterizer';
