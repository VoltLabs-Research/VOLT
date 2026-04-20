import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema } from 'mongoose';
import mongoose from 'mongoose';
import type { LatexFileProps } from '@modules/latex/domain/entities/LatexFile';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum LatexFileRelation {
    Document = 'document',
    Team = 'team',
    CreatedBy = 'createdBy'
};

export interface LatexFileDocument extends Persistable<LatexFileProps, `${LatexFileRelation}`>, Document {};

const LatexFileSchema: Schema<LatexFileDocument> = new Schema({
    document: {
        type: Schema.Types.ObjectId,
        ref: 'LatexDocument',
        required: true
    },
    team: {
        ...teamRefField(true)
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    path: {
        type: String,
        default: '',
        trim: true
    },
    content: {
        type: String,
        default: ''
    },
    isEntrypoint: {
        type: Boolean,
        default: false
    },
    createdBy: {
        ...userRefField(true)
    }
}, {
    timestamps: true
});

/** Prevents duplicate filenames at the same path within a document. */
LatexFileSchema.index({ document: 1, name: 1, path: 1 }, { unique: true });
LatexFileSchema.index({ document: 1, isEntrypoint: 1 });
LatexFileSchema.index({ document: 1, createdAt: 1 });
LatexFileSchema.index({ team: 1 });

const LatexFileModel: Model<LatexFileDocument> = mongoose.model<LatexFileDocument>(
    'LatexFile',
    LatexFileSchema
);

export default LatexFileModel;
