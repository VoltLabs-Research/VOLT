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

const toFrameMetadata = (header: ReturnType<typeof readHeader>): ParsedFrameMetadata => {
    const [a, b, c] = header.cellVectors;

    return {
        timestep: header.timestep,
        natoms: header.natoms,
        headers: header.headers,
        simulationCell: {
            boundingBox: {
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

const parseTrajectoryMetadata = (filePath: string, frame = 0): ParsedFrameMetadata =>
    toFrameMetadata(readHeader(filePath, { frame }));

export const scanTrajectoryFrames = (filePath: string): ScannedFrame[] => (
    scanFrames(filePath).frames.map((frame) => ({
        index: frame.index,
        byteOffset: frame.byteOffset,
        byteLength: frame.byteLength,
        metadata: parseTrajectoryMetadata(filePath, frame.index)
    }))
);
