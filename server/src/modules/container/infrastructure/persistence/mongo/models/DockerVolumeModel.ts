import mongoose, { Document, Schema } from 'mongoose';

export interface IDockerVolume extends Document {
    volumeId: string;
    name: string;
    driver: string;
    createdAt: Date;
    updatedAt: Date;
};

const volumeIdField = {
    type: String,
    required: true,
    unique: true
};

const volumeNameField = {
    type: String,
    required: true
};

const volumeDriverField = {
    type: String,
    default: 'local'
};

const DockerVolumeSchema = new Schema<IDockerVolume>({
    volumeId: volumeIdField,
    name: volumeNameField,
    driver: volumeDriverField
}, {
    timestamps: true
});

export const DockerVolume = mongoose.model<IDockerVolume>('DockerVolume', DockerVolumeSchema);
