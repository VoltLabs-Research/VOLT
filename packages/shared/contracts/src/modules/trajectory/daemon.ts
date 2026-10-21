import type { SimulationCellGeometry } from '../simulation-cell/domain';

// Results of the trajectory.native.* commands in DaemonCommand.

export interface NativeSimulationCell{
    boundingBox: {
        width: number;
        height: number;
        length: number;
    };
    geometry: SimulationCellGeometry;
}

export interface NativeFrameMetadata{
    timestep: number;
    natoms: number;
    headers: string[];
    simulationCell: NativeSimulationCell;
}

export interface NativeAtomRow{
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
    [property: string]: number;
}

export interface NativeAtomsPage{
    atoms: NativeAtomRow[];
    totalAtoms: number;
    nativeProperties: string[];
    // Present when an analysis was requested: its per-atom properties, aligned with atoms.
    analysisPropertyNames?: string[];
    analysisAtoms?: Record<string, unknown>[];
}

export interface NativeFilterPreview{
    mask: Uint8Array;
    matchCount: number;
    totalAtoms: number;
}
