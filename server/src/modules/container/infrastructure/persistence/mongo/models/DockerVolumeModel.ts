import mongoose, { Schema, Document } from 'mongoose';

export interface IDockerVolume extends Document {
    volumeId: string;
    name: string;
    driver: string;
    createdAt: Date;
    updatedAt: Date;
}

const DockerVolumeSchema = new Schema<IDockerVolume>({
    volumeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    driver: { type: String, default: 'local' }
}, {
    timestamps: true
});

export const DockerVolume = mongoose.model<IDockerVolume>('DockerVolume', DockerVolumeSchema);
