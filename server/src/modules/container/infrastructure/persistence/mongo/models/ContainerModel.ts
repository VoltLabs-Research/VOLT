import mongoose, { Schema, Document } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

export interface IContainer extends Document {
    name: string;
    image: string;
    containerId: string;
    internalIp?: string;
    network?: mongoose.Types.ObjectId;
    volume?: mongoose.Types.ObjectId;
    team?: mongoose.Types.ObjectId;
    status: string;
    memory: number;
    cpus: number;
    env: Array<{ key: string; value: string }>;
    ports: Array<{ private: number; public: number }>;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

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
    internalIp: { type: String, required: false },
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
    status: { type: String, default: 'created' },
    memory: { type: Number, default: 512 },
    cpus: { type: Number, default: 1 },
    env: [{ key: String, value: String }],
    ports: [{ private: Number, public: Number }],
    createdBy: {
        ...userRefField([true, ValidationCodes.CONTAINER_CREATED_BY_REQUIRED])
    }
}, {
    timestamps: true
});

ContainerSchema.index({ name: 'text', image: 'text' });

export const ContainerModel = mongoose.model<IContainer>('Container', ContainerSchema);
