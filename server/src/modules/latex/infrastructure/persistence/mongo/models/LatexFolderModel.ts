import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema, Types } from 'mongoose';
import mongoose from 'mongoose';

export interface LatexFolderDocument extends Document {
    _id: Types.ObjectId;
    team: Types.ObjectId;
    createdBy: Types.ObjectId;
    title: string;
    parent: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
};

const LatexFolderSchema = new Schema<LatexFolderDocument>({
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
        ref: 'LatexFolder',
        default: null,
        required: false
    }
}, {
    timestamps: true
});

LatexFolderSchema.index({ team: 1, parent: 1, createdAt: -1 });
LatexFolderSchema.index({ team: 1, title: 1 });

const LatexFolderModel: Model<LatexFolderDocument> = mongoose.model<LatexFolderDocument>(
    'LatexFolder',
    LatexFolderSchema
);

export default LatexFolderModel;
