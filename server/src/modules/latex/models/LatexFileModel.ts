import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export interface LatexFileProps {
    document: string;
    team: string;
    
    name: string;
    
    path: string;
    content: string;
    
    isEntrypoint: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

type LatexFileRelations = 'document' | 'team' | 'createdBy';

export interface LatexFileDocument extends Persistable<LatexFileProps, LatexFileRelations>, Document {}

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

LatexFileSchema.index({ document: 1, name: 1, path: 1 }, { unique: true });
LatexFileSchema.index({ document: 1, isEntrypoint: 1 });
LatexFileSchema.index({ document: 1, createdAt: 1 });
LatexFileSchema.index({ team: 1 });

const LatexFileModel: Model<LatexFileDocument> = mongoose.model<LatexFileDocument>(
    'LatexFile',
    LatexFileSchema
);

export default LatexFileModel;
