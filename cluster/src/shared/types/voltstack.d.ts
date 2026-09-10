declare module '@voltstack/lammps-io' {
    type Vec3 = [number, number, number];

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
        xy: number;
        xz: number;
        yz: number;
    }

    export interface FrameHeader {
        format: TrajectoryFormat;
        timestep: number;
        natoms: number;
        boxBounds: BoxBounds;
        cellVectors: [Vec3, Vec3, Vec3];
        cellOrigin: Vec3;
        pbc: [boolean, boolean, boolean];
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
        ids?: Uint32Array;
        properties?: Record<string, Int32Array | Float32Array>;
        propertyDtypes?: Record<string, ColumnDtype>;
        metadata: FrameHeader;
        min: Vec3;
        max: Vec3;
        massesByType?: number[];
        elementHintsByType?: (string | null)[];
    }

    export interface ReadOptions {
        frame?: number;
        includeIds?: boolean;
        properties?: string[];
    }

    export function detectFormat(filePath: string): TrajectoryFormat | null;
    export function scanFrames(filePath: string): ScanResult;
    export function readHeader(filePath: string, options?: Pick<ReadOptions, 'frame'>): FrameHeader;
    export function readFrame(filePath: string, options?: ReadOptions): ParsedFrame;
}
declare module '@voltstack/spatial-assembler';
declare module '@voltstack/headless-rasterizer';
