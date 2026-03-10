import mongoose, { Schema } from 'mongoose';

export interface TrajectoryDocument {
    _id: string;
    name?: string;
    team?: string;
    teamCluster?: string;
    createdBy?: string;
    status?: string;
    frames?: Array<Record<string, unknown>>;
    analysis?: string[];
    rasterSceneViews?: number;
    stats?: Record<string, unknown>;
    updatedAt?: Date;
    createdAt?: Date;
};

const trajectorySchema = new Schema({}, {
    collection: 'trajectories',
    strict: false
});

export const TrajectoryModel = mongoose.models.DaemonTrajectory
    || mongoose.model<TrajectoryDocument>('DaemonTrajectory', trajectorySchema);
