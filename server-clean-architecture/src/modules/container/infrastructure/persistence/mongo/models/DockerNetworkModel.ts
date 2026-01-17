import mongoose, { Schema, Document } from 'mongoose';

export interface IDockerNetwork extends Document {
    networkId: string;
    name: string;
    driver: string;
    createdAt: Date;
    updatedAt: Date;
}

const DockerNetworkSchema = new Schema<IDockerNetwork>({
    networkId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    driver: { type: String, default: 'bridge' }
}, {
    timestamps: true
});

export const DockerNetwork = mongoose.model<IDockerNetwork>('DockerNetwork', DockerNetworkSchema);
