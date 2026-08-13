import { readHeader, scanFrames } from '@voltstack/lammps-io';

interface ParsedSimulationCellGeometry {
    cell_vectors: [[number, number, number], [number, number, number], [number, number, number]];
    cell_origin: [number, number, number];
    periodic_boundary_conditions: { x: boolean; y: boolean; z: boolean };
}

export interface ParsedSimulationCell {
    boundingBox: { width: number; height: number; length: number };
    geometry: ParsedSimulationCellGeometry;
}

export interface ParsedFrameMetadata {
    timestep: number;
    natoms: number;
    headers: string[];
    simulationCell: ParsedSimulationCell;
}

export interface ScannedFrame {
    index: number;
    byteOffset: number;
    byteLength: number;
    metadata: ParsedFrameMetadata;
}

/**
 * Adapts one frame header from the reader to the shape the rest of the daemon and the
 * API speak.
 *
 * There is no format sniffing or cell arithmetic left here. Both used to live in this
 * file — a hand-written LAMMPS header parser deciding which uploads were acceptable,
 * next to a native parser that decided which ones could actually be processed. They
 * disagreed, which is how `.xyz` came to be accepted by the gate and then fail during
 * GLB generation. The reader is now the only thing with an opinion about formats.
 */
const toFrameMetadata = (header: ReturnType<typeof readHeader>): ParsedFrameMetadata => {
    const [a, b, c] = header.cellVectors;

    return {
        timestep: header.timestep,
        natoms: header.natoms,
        headers: header.headers,
        simulationCell: {
            boundingBox: {
                // The axis-aligned extent of the cell: for a sheared cell the vectors are
                // what describe it, and these are only the box the viewer frames it in.
                width: Math.abs(a[0]),
                length: Math.abs(b[1]),
                height: Math.abs(c[2])
            },
            geometry: {
                cell_vectors: [a, b, c],
                cell_origin: header.cellOrigin,
                periodic_boundary_conditions: {
                    x: header.pbc[0],
                    y: header.pbc[1],
                    z: header.pbc[2]
                }
            }
        }
    };
};

/** Metadata for a single frame of a file, without reading its atoms. */
const parseTrajectoryMetadata = (filePath: string, frame = 0): ParsedFrameMetadata =>
    toFrameMetadata(readHeader(filePath, { frame }));

/**
 * Every frame in a file, with the byte range each one occupies.
 *
 * The ranges are what let a multi-frame upload be split into one file per frame by
 * copying bytes, which keeps the rest of the pipeline — and the analysis plugins, which
 * are handed a dump file per timestep — working on exactly the input they expect.
 */
export const scanTrajectoryFrames = (filePath: string): ScannedFrame[] => (
    scanFrames(filePath).frames.map((frame) => ({
        index: frame.index,
        byteOffset: frame.byteOffset,
        byteLength: frame.byteLength,
        metadata: parseTrajectoryMetadata(filePath, frame.index)
    }))
);
