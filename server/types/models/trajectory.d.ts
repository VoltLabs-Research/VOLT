import { ITeam } from '@types/models/team';
import { IUser } from '@/types/models/user';
import { IStructureAnalysis } from '@types/model/structureAnalysis';
import { ICellAnalysis } from '@/types/model/simulation-cell';
import { IAnalysis } from '@/models/trajectory/analysis';
import { Document, Types } from 'mongoose';

// Defines the limits of the simulation box on the three axes.
export interface IBoxBounds {
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

export interface ITimestepInfo {
    timestep: number;
    natoms: number;
    simulationCell: Types.ObjectId;
}

export interface ITrajectory extends Document {
    name: string;
    status: 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';
    isPublic: boolean;
    team: ITeam;
    createdBy: IUser;
    rasterSceneViews: number;
    frames: ITimestepInfo[];
    analysis: IAnalysis[];
    preview: string;
    stats: {
        totalFiles: number;
        totalSize: number;
    };
    uploadId?: string;
    createdAt: Date;
    updatedAt: Date;
}
