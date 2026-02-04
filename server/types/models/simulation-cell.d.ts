import { Document, Types } from 'mongoose';
import { IAnalysisConfig } from '@/types/models/analysis-config';

interface IPeriodicBoundaryConditions {
    x: boolean;
    y: boolean;
    z: boolean;
}

interface ILatticeAngles {
    alpha: number;
    beta: number;
    gamma: number;
}

interface IReciprocalLattice {
    matrix: number[][];
    volume: number;
}

interface IDimensionality {
    is_2d: boolean;
    effective_dimensions: number;
}

export interface ICellAnalysis extends Document {
    matrix: number[][];
    volume: number;
    periodicBoundaryConditions: IPeriodicBoundaryConditions;
    angles: ILatticeAngles;
    reciprocalLattice: IReciprocalLattice;
    dimensionality: IDimensionality;
    timestep: number;
    trajectory: Types.ObjectId;
    analysisConfig: Types.ObjectId;
}

export interface ISimulationCellGeometry {
    cell_vectors: number[][];
    cell_origin: number[];
    periodic_boundary_conditions: {
        x: boolean;
        y: boolean;
        z: boolean;
    };
}

export interface ISimulationCellBoundingBox {
    width: number;
    height: number;
    length: number;
}

export interface ISimulationCell extends Document {
    boundingBox: ISimulationCellBoundingBox;
    geometry: ISimulationCellGeometry;
    team: Types.ObjectId;
    trajectory: Types.ObjectId;
    timestep: number;
}
