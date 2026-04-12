import mongoose, { Document, Schema } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';
import type { ContainerEnvironmentVariable, ContainerPortMapping } from '@modules/container/domain/port/IContainerService';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

interface ContainerEnvironmentVariableDocument extends ContainerEnvironmentVariable {};
interface ContainerPortMappingDocument extends ContainerPortMapping {};

export interface IContainer extends Document {
    name: string;
    image: string;
    containerId: string;
    folder: mongoose.Types.ObjectId | null;
    internalIp?: string;
    network?: mongoose.Types.ObjectId;
    volume?: mongoose.Types.ObjectId;
    team?: mongoose.Types.ObjectId;
    teamCluster?: mongoose.Types.ObjectId;
    status: string;
    memory: number;
    cpus: number;
    env: ContainerEnvironmentVariableDocument[];
    ports: ContainerPortMappingDocument[];
    mountDockerSocket?: boolean;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
};

const internalIpField = {
    type: String,
    required: false,
    default: undefined
};

const statusField = {
    type: String,
    default: 'created'
};

const memoryField = {
    type: Number,
    default: 512
};

const cpusField = {
    type: Number,
    default: 1
};

const environmentVariableField = {
    key: String,
    value: String
};

const portMappingField = {
    private: Number,
    public: {
        type: Number,
        required: false,
        default: undefined
    }
};

const ContainerSchema = new Schema<IContainer>({
    name: {
        type: String,
        required: [true, ValidationCodes.CONTAINER_NAME_REQUIRED],
        trim: true
    },
    image: {
        type: String,
        required: [true, ValidationCodes.CONTAINER_IMAGE_REQUIRED],
        trim: true
    },
    containerId: {
        type: String,
        required: [true, ValidationCodes.CONTAINER_ID_REQUIRED],
        unique: true
    },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'CatalogFolder',
        required: false,
        default: null
    },
    internalIp: internalIpField,
    network: {
        type: Schema.Types.ObjectId,
        ref: 'DockerNetwork',
        required: false
    },
    volume: {
        type: Schema.Types.ObjectId,
        ref: 'DockerVolume',
        required: false
    },
    team: {
        ...teamRefField(false)
    },
    teamCluster: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true
    },
    status: statusField,
    memory: memoryField,
    cpus: cpusField,
    env: [environmentVariableField],
    ports: [portMappingField],
    mountDockerSocket: {
        type: Boolean,
        default: false
    },
    createdBy: {
        ...userRefField([true, ValidationCodes.CONTAINER_CREATED_BY_REQUIRED])
    }
}, {
    timestamps: true
});

ContainerSchema.index({ name: 'text', image: 'text' });
ContainerSchema.index({ team: 1, folder: 1, createdAt: -1 });

export const ContainerModel = mongoose.model<IContainer>('Container', ContainerSchema);
