import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema, Types } from 'mongoose';
import mongoose from 'mongoose';

export interface WhiteboardFolderDocument extends Document {
    _id: Types.ObjectId;
    team: Types.ObjectId;
    createdBy: Types.ObjectId;
    title: string;
    parent: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
};

const WhiteboardFolderSchema = new Schema<WhiteboardFolderDocument>({
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
        ref: 'WhiteboardFolder',
        default: null,
        required: false
    }
}, {
    timestamps: true
});

WhiteboardFolderSchema.index({ team: 1, parent: 1, createdAt: -1 });
WhiteboardFolderSchema.index({ team: 1, title: 1 });

const WhiteboardFolderModel: Model<WhiteboardFolderDocument> = mongoose.model<WhiteboardFolderDocument>(
    'WhiteboardFolder',
    WhiteboardFolderSchema
);

export default WhiteboardFolderModel;
