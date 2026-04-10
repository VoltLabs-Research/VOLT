import mongoose, { Document, Model, Schema } from 'mongoose';
import { LammpsContainerStatus } from '@modules/lammps/domain/LammpsTypes';

export interface LammpsContainerDocument extends Document {
    team: mongoose.Types.ObjectId;
    name: string;
    packages: string[];
    cpus: number;
    teamClusterId: mongoose.Types.ObjectId;
    storageClusterId: mongoose.Types.ObjectId;
    operationId?: string;
    status: LammpsContainerStatus;
    imageTag?: string;
    imageHash?: string;
    workspaceContainerId?: string;
    workspaceContainerName?: string;
    workspaceRootPath?: string;
    lastError?: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const LammpsContainerSchema = new Schema<LammpsContainerDocument>({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    packages: {
        type: [String],
        default: []
    },
    cpus: {
        type: Number,
        default: 1,
        min: 1
    },
    teamClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true,
        index: true
    },
    storageClusterId: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true,
        index: true
    },
    operationId: {
        type: String,
        index: true
    },
    status: {
        type: String,
        enum: Object.values(LammpsContainerStatus),
        default: LammpsContainerStatus.Provisioning,
        index: true
    },
    imageTag: String,
    imageHash: String,
    workspaceContainerId: String,
    workspaceContainerName: String,
    workspaceRootPath: String,
    lastError: String,
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    minimize: false
});

LammpsContainerSchema.index({ team: 1, updatedAt: -1 }, { name: 'lammps_container_team_updated_idx' });
LammpsContainerSchema.index({ team: 1, name: 1 }, { name: 'lammps_container_team_name_idx' });

const LammpsContainerModel: Model<LammpsContainerDocument> = mongoose.models.LammpsContainer
    || mongoose.model<LammpsContainerDocument>('LammpsContainer', LammpsContainerSchema);

export default LammpsContainerModel;
