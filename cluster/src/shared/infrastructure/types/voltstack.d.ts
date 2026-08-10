declare module '@voltstack/lammps-io' {
    type Vec3 = [number, number, number];
    type AtomIdArray = Float32Array | Float64Array | Int32Array | Uint32Array | Uint16Array;

    export interface NativeParseResult {
        metadata: { headers: string[] };
        positions: Float32Array;
        types: Uint16Array;
        ids?: AtomIdArray;
        properties?: Record<string, Float32Array | Float64Array>;
        min: Vec3;
        max: Vec3;
    }

    export interface NativeParseOptions {
        includeIds?: boolean;
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
