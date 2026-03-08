import mongoose, { Document, Schema } from 'mongoose';

export interface IDockerNetwork extends Document {
    networkId: string;
    name: string;
    driver: string;
    createdAt: Date;
    updatedAt: Date;
};

const networkIdField = {
    type: String,
    required: true,
    unique: true
};

const networkNameField = {
    type: String,
    required: true
};

const networkDriverField = {
    type: String,
    default: 'bridge'
};

const DockerNetworkSchema = new Schema<IDockerNetwork>({
    networkId: networkIdField,
    name: networkNameField,
    driver: networkDriverField
}, {
    timestamps: true
});

export const DockerNetwork = mongoose.model<IDockerNetwork>('DockerNetwork', DockerNetworkSchema);
