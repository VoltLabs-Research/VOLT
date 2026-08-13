declare module '@voltstack/lammps-io' {
    type Vec3 = [number, number, number];

    /** Matches the shared ColumnDType union — the daemon maps these onto typed arrays. */
    type ColumnDtype = 'i32' | 'f32';

    type TrajectoryFormat =
        | 'lammps-dump'
        | 'lammps-dump-binary'
        | 'lammps-dump-yaml'
        | 'lammps-data'
        | 'extxyz';

    interface BoxBounds {
        xlo: number;
        xhi: number;
        ylo: number;
        yhi: number;
        zlo: number;
        zhi: number;
        /** Triclinic tilt factors; zero for an orthogonal cell. */
        xy: number;
        xz: number;
        yz: number;
    }

    export interface FrameHeader {
        format: TrajectoryFormat;
        timestep: number;
        natoms: number;
        /** LAMMPS-shaped cell. Cannot express a lattice that is not upper triangular. */
        boxBounds: BoxBounds;
        /** The three cell vectors as read, `cellVectors[0]` being a. The faithful form. */
        cellVectors: [Vec3, Vec3, Vec3];
        cellOrigin: Vec3;
        /** Per-axis periodic boundary flags. */
        pbc: [boolean, boolean, boolean];
        /** Column names as they appear in the file, lowercased. */
        headers: string[];
    }

    export interface FrameIndexEntry {
        index: number;
        byteOffset: number;
        byteLength: number;
        timestep: number;
        natoms: number;
    }

    export interface ScanResult {
        format: TrajectoryFormat;
        frames: FrameIndexEntry[];
    }

    export interface ParsedFrame {
        positions: Float32Array;
        types: Uint16Array;
        /** Present only when `includeIds` was set and the format carries ids. */
        ids?: Uint32Array;
        properties?: Record<string, Int32Array | Float32Array>;
        /** Parallel to `properties`: how each column was formatted in the file. */
        propertyDtypes?: Record<string, ColumnDtype>;
        metadata: FrameHeader;
        min: Vec3;
        max: Vec3;
        /** Data files: 1-indexed by LAMMPS type, so index 0 holds type 1. */
        massesByType?: number[];
        /** Element symbols per type: a data file's `# <symbol>` comments, or XYZ species. */
        elementHintsByType?: (string | null)[];
    }

    export interface ReadOptions {
        frame?: number;
        includeIds?: boolean;
        /** Extra per-atom columns. `['*']` requests every non-base column in the file. */
        properties?: string[];
    }

    /** Null when nothing recognizes the file. Throws when it cannot be opened. */
    export function detectFormat(filePath: string): TrajectoryFormat | null;
    export function scanFrames(filePath: string): ScanResult;
    export function readHeader(filePath: string, options?: Pick<ReadOptions, 'frame'>): FrameHeader;
    export function readFrame(filePath: string, options?: ReadOptions): ParsedFrame;
}
declare module '@voltstack/spatial-assembler';
declare module '@voltstack/headless-rasterizer';
