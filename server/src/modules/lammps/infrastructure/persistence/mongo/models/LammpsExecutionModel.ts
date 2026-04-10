import mongoose, { Document, Model, Schema } from 'mongoose';
import { LammpsExecutionStatus } from '@modules/lammps/domain/LammpsTypes';

export interface LammpsExecutionDocument extends Document {
    team: mongoose.Types.ObjectId;
    script: mongoose.Types.ObjectId;
    container: mongoose.Types.ObjectId;
    requestedBy: mongoose.Types.ObjectId;
    computeClusterId: mongoose.Types.ObjectId;
    storageClusterId: mongoose.Types.ObjectId;
    runtimeRunId?: string;
    stagedTrajectoryId: string;
    status: LammpsExecutionStatus;
    terminalBuffer: string;
    lastTimestep?: number;
    dumpCount: number;
    startedAt?: Date;
    finishedAt?: Date;
    exitCode?: number | null;
    errorMessage?: string;
    importedTrajectoryId?: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const LammpsExecutionSchema = new Schema<LammpsExecutionDocument>({
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
    container: {
        type: Schema.Types.ObjectId,
        ref: 'LammpsContainer',
        required: true,
        index: true
    },
    requestedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    computeClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true
    },
    storageClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true
    },
    runtimeRunId: {
        type: String,
        index: true
    },
    stagedTrajectoryId: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(LammpsExecutionStatus),
        default: LammpsExecutionStatus.Pending,
        index: true
    },
    terminalBuffer: {
        type: String,
        default: ''
    },
    lastTimestep: Number,
    dumpCount: {
        type: Number,
        default: 0
    },
    startedAt: Date,
    finishedAt: Date,
    exitCode: {
        type: Number,
        default: null
    },
    errorMessage: String,
    importedTrajectoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        default: null
    }
}, {
    timestamps: true,
    minimize: false
});

LammpsExecutionSchema.index({ team: 1, updatedAt: -1 }, { name: 'lammps_execution_team_updated_idx' });
LammpsExecutionSchema.index({ script: 1, createdAt: -1 }, { name: 'lammps_execution_script_created_idx' });

const LammpsExecutionModel: Model<LammpsExecutionDocument> = mongoose.models.LammpsExecution
    || mongoose.model<LammpsExecutionDocument>('LammpsExecution', LammpsExecutionSchema);

export default LammpsExecutionModel;
