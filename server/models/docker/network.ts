import mongoose, { Schema, Document, Model } from 'mongoose';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import { ValidationCodes } from '@/constants/validation-codes';

export interface IDockerNetwork extends Document {
    networkId: string;
    name: string;
    driver: string;
    container?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const DockerNetworkSchema = new Schema<IDockerNetwork>({
    networkId: {
        type: String,
        required: [true, ValidationCodes.DOCKER_NETWORK_ID_REQUIRED],
        unique: true
    },
    name: {
        type: String,
        required: [true, ValidationCodes.DOCKER_NETWORK_NAME_REQUIRED],
        trim: true
    },
    driver: {
        type: String,
        default: 'bridge'
    },
    container: {
        type: Schema.Types.ObjectId,
        ref: 'Container',
        required: false,
        inverse: { path: 'network', behavior: 'set' }
    }
}, {
    timestamps: true
});

DockerNetworkSchema.plugin(useCascadeDelete);

const DockerNetwork: Model<IDockerNetwork> = mongoose.model<IDockerNetwork>('DockerNetwork', DockerNetworkSchema);

export default DockerNetwork;
