import mongoose, { Schema, Document, Model } from 'mongoose';
import { Team } from '@/models/index';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';

export interface IContainer extends Document {
    name: string;
    image: string;
    containerId: string;
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
        required: [true, 'Container::Name::Required'],
        trim: true
    },
    image: {
        type: String,
        required: [true, 'Container::Image::Required'],
        trim: true
    },
    containerId: {
        type: String,
        required: [true, 'Container::ContainerId::Required'],
        unique: true
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: false
    },
    status: {
        type: String,
        default: 'created'
    },
    memory: {
        type: Number,
        default: 512 // MB
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
        required: [true, 'Container::CreatedBy::Required']
    }
}, {
    timestamps: true
});

ContainerSchema.plugin(useCascadeDelete);

const Container: Model<IContainer> = mongoose.model<IContainer>('Container', ContainerSchema);

export default Container;
