import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface ContainerFolderDocument extends Document {
    _id: Types.ObjectId;
    team: Types.ObjectId;
    createdBy: Types.ObjectId;
    title: string;
    parent: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const ContainerFolderSchema = new Schema<ContainerFolderDocument>({
    team: {
        ...teamRefField(true),
        cascade: 'delete'
    },
    createdBy: {
        ...userRefField(true)
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    parent: {
        type: Schema.Types.ObjectId,
        ref: 'ContainerFolder',
        default: null,
        required: false
    }
}, {
    timestamps: true
});

ContainerFolderSchema.index({ team: 1, parent: 1, createdAt: -1 });
ContainerFolderSchema.index({ team: 1, title: 1 });

const ContainerFolderModel: Model<ContainerFolderDocument> = mongoose.model<ContainerFolderDocument>('ContainerFolder', ContainerFolderSchema);

export default ContainerFolderModel;
