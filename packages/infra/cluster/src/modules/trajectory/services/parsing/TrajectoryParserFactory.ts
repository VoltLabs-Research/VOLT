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

// The header of a file's first frame. readHeader maps the whole file and scans every frame of it to
// find the one asked for, so the frames of a trajectory are read from files of their own.
export const readTrajectoryFrameMetadata = (filePath: string): ParsedFrameMetadata =>
    toFrameMetadata(readHeader(filePath, { frame: 0 }));

// Where each frame of a file is, from a single scan of it.
export const scanTrajectoryFrames = (filePath: string): ScannedFrame[] => (
    scanFrames(filePath).frames.map((frame) => ({
        index: frame.index,
        byteOffset: frame.byteOffset,
        byteLength: frame.byteLength
    }))
);
