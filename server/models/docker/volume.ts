import { Schema, model, Document } from 'mongoose';
import useCascadeDelete from '@/utilities/mongo/inverse-relations';
import { ValidationCodes } from '@/constants/validation-codes';

export interface IDockerVolume extends Document {
    volumeId: string;
    name: string;
    driver: string;
    container?: Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const DockerVolumeSchema = new Schema<IDockerVolume>({
    volumeId: {
        type: String,
        required: [true, ValidationCodes.DOCKER_VOLUME_ID_REQUIRED],
        unique: true
    },
    name: {
        type: String,
        required: [true, ValidationCodes.DOCKER_VOLUME_NAME_REQUIRED]
    },
    driver: {
        type: String,
        default: 'local'
    },
    container: {
        type: Schema.Types.ObjectId,
        ref: 'Container',
        required: false
    }
}, {
    timestamps: true
});

DockerVolumeSchema.plugin(useCascadeDelete);

export default model<IDockerVolume>('DockerVolume', DockerVolumeSchema);
