import mongoose, { Schema, Document, Model } from 'mongoose';
import { Team } from '@/models/index';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import { ValidationCodes } from '@/constants/validation-codes';

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
    internalIp: {
        type: String,
        required: false
    },
    network: {
        type: Schema.Types.ObjectId,
        ref: 'DockerNetwork',
        required: false,
        cascade: 'delete'
    },
    volume: {
        type: Schema.Types.ObjectId,
        ref: 'DockerVolume',
        required: false,
        cascade: 'delete'
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: false,
        inverse: { path: 'containers', behavior: 'addToSet' }
    },
    status: {
        type: String,
        default: 'created'
    },
    memory: {
        type: Number,
        default: 512
    },
    cpus: {
        type: Number,
        default: 1
    },
    env: [{
        key: String,
        value: String
    }],
    ports: [{
        private: Number,
        public: Number
    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.CONTAINER_CREATED_BY_REQUIRED]
    }
}, {
    timestamps: true
});

ContainerSchema.index({ name: 'text', image: 'text' });

ContainerSchema.plugin(useCascadeDelete);
ContainerSchema.plugin(useInverseRelations);

ContainerSchema.pre('deleteOne', { document: true, query: false }, async function () {
    const container = this as any;
    if (container.team) {
        await mongoose.model('Team').updateOne(
            { _id: container.team },
            { $pull: { containers: container._id } }
        );
    }

    if (container.network) {
        await mongoose.model('DockerNetwork').deleteOne({ _id: container.network });
    }
    if (container.volume) {
        await mongoose.model('DockerVolume').deleteOne({ _id: container.volume });
    }
});

ContainerSchema.pre('findOneAndDelete', async function (next) {
    const doc = await this.model.findOne(this.getFilter());
    if (doc) {
        if (doc.network) {
            await mongoose.model('DockerNetwork').deleteOne({ _id: doc.network });
        }
        if (doc.volume) {
            await mongoose.model('DockerVolume').deleteOne({ _id: doc.volume });
        }
    }
    next();
});

// Handle deleteMany
ContainerSchema.pre('deleteMany', async function (next) {
    const docs = await this.model.find(this.getFilter());
    for (const doc of docs) {
        if (doc.network) {
            await mongoose.model('DockerNetwork').deleteOne({ _id: doc.network });
        }
        if (doc.volume) {
            await mongoose.model('DockerVolume').deleteOne({ _id: doc.volume });
        }
    }
    next();
});

const Container: Model<IContainer> = mongoose.model<IContainer>('Container', ContainerSchema);

export default Container;
