import { Document, Types } from 'mongoose';

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
    inverseMatrix: number[][];
    volume: number;
    periodicBoundaryConditions: IPeriodicBoundaryConditions;
    angles: ILatticeAngles;
    reciprocalLattice: IReciprocalLattice;
    dimensionality: IDimensionality;
    timestep: number;
    trajectory: Types.ObjectId;
}