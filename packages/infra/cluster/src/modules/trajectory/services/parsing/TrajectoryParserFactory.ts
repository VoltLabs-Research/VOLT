import { readHeader, scanFrames } from '@voltstack/lammps-io';
import type { NativeFrameMetadata, NativeSimulationCell } from '@volt/contracts/modules/trajectory/daemon';

type Vec3 = [number, number, number];

// The parser always yields full 3x3 cells, so it narrows the wire geometry to tuples.
export interface ParsedSimulationCell extends NativeSimulationCell {
    geometry: NativeSimulationCell['geometry'] & {
        cell_vectors: [Vec3, Vec3, Vec3];
        cell_origin: Vec3;
    };
}

export interface ParsedFrameMetadata extends NativeFrameMetadata {
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
