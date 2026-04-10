import mongoose, { Document, Model, Schema } from 'mongoose';
import { LammpsDumpStatus } from '@modules/lammps/domain/LammpsTypes';

export interface LammpsDumpDocument extends Document {
    team: mongoose.Types.ObjectId;
    script: mongoose.Types.ObjectId;
    execution: mongoose.Types.ObjectId;
    stagedTrajectoryId: string;
    timestep: number;
    fileName: string;
    dumpObjectKey: string;
    modelObjectKey?: string;
    storageClusterId: mongoose.Types.ObjectId;
    sizeBytes?: number;
    natoms?: number;
    simulationCell?: Record<string, unknown> | null;
    status: LammpsDumpStatus;
    exportedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const LammpsDumpSchema = new Schema<LammpsDumpDocument>({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        index: true
    },
    script: {
        type: Schema.Types.ObjectId,
        ref: 'LammpsScript',
        required: true,
        index: true
    },
    execution: {
        type: Schema.Types.ObjectId,
        ref: 'LammpsExecution',
        required: true,
        index: true
    },
    stagedTrajectoryId: {
        type: String,
        required: true,
        index: true
    },
    timestep: {
        type: Number,
        required: true,
        index: true
    },
    fileName: {
        type: String,
        required: true
    },
    dumpObjectKey: {
        type: String,
        required: true,
        unique: true
    },
    modelObjectKey: String,
    storageClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true,
        index: true
    },
    sizeBytes: Number,
    natoms: Number,
    simulationCell: {
        type: Schema.Types.Mixed,
        default: null
    },
    status: {
        type: String,
        enum: Object.values(LammpsDumpStatus),
        default: LammpsDumpStatus.Ready
    },
    exportedAt: Date
}, {
    timestamps: true,
    minimize: false
});

LammpsDumpSchema.index({ execution: 1, timestep: 1 }, { unique: true, name: 'lammps_dump_execution_timestep_idx' });
LammpsDumpSchema.index({ team: 1, createdAt: -1 }, { name: 'lammps_dump_team_created_idx' });

const LammpsDumpModel: Model<LammpsDumpDocument> = mongoose.models.LammpsDump
    || mongoose.model<LammpsDumpDocument>('LammpsDump', LammpsDumpSchema);

export default LammpsDumpModel;
