import { Document } from 'mongoose';
import { ITrajectory } from '@types/models/trajectory';

export interface IStructureTypeStat{
    name: string;
    count: number;
    percentage: number;
    typeId: number;
}

export interface IStructureAnalysis extends Document{
    totalAtoms: number;
    analysisMethod: 'PTM' | 'CNA';
    types: IStructureTypeStat[];
    timestep: number;
    identifiedStructures: number;
    unidentifiedStructures: number;
    identificationRate: number;
    trajectory: mongoose.Types.ObjectId;
}