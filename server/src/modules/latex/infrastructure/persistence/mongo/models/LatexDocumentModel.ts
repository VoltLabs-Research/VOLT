import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema, Types } from 'mongoose';
import mongoose from 'mongoose';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum LatexDocumentRelation {
    Team = 'team',
    CreatedBy = 'createdBy'
};

type LatexDocumentDocumentBase = Persistable<LatexDocumentProps, `${LatexDocumentRelation}`>;

export interface LatexDocumentDocument extends Omit<LatexDocumentDocumentBase, 'folder'>, Document {
    folder: Types.ObjectId | null;
};

const LatexDocumentSchema: Schema<LatexDocumentDocument> = new Schema({
    team: {
        ...teamRefField(true),
        cascade: 'delete'
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: false,
        default: ''
    },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'LatexFolder',
        default: null,
        required: false
    },
    createdBy: {
        ...userRefField(true)
    }
}, {
    timestamps: true
});

LatexDocumentSchema.index({ team: 1, folder: 1, createdAt: -1 });

const LatexDocumentModel: Model<LatexDocumentDocument> = mongoose.model<LatexDocumentDocument>(
    'LatexDocument',
    LatexDocumentSchema
);

export default LatexDocumentModel;
