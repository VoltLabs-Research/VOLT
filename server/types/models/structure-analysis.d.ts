import { Document } from 'mongoose';
import { ITrajectory } from '@types/models/trajectory';
import { IAnalysisConfig } from '@/types/models/analysis-config';

export interface IStructureTypeStat{
    name: string;
    count: number;
    percentage: number;
    typeId: number;
}

export interface IStructureAnalysis extends Document{
    totalAtoms: number;
    analysisMethod: 'PTM' | 'CNA' | 'DIAMOND';
    types: IStructureTypeStat[];
    timestep: number;
    identifiedStructures: number;
    unidentifiedStructures: number;
    identificationRate: number;
    trajectory: mongoose.Types.ObjectId;
    analysisConfig: mongoose.Types.ObjectId;
}
