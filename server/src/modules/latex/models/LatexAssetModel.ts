import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';
import type { LatexAssetProps } from '@modules/latex/entities/LatexAsset';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

type LatexAssetRelations = 'team' | 'document' | 'createdBy';

export interface LatexAssetDocument extends Persistable<LatexAssetProps, LatexAssetRelations>, Document {}

const LatexAssetSchema: Schema<LatexAssetDocument> = new Schema({
    team: {
        ...teamRefField(true)
    },
    document: {
        type: Schema.Types.ObjectId,
        ref: 'LatexDocument',
        required: true
    },
    originalName: {
        type: String,
        required: true,
        trim: true
    },
    path: {
        type: String,
        trim: true,
        required: true
    },
    storageKey: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    mimetype: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    createdBy: {
        ...userRefField(true)
    }
}, {
    timestamps: true
});

LatexAssetSchema.index({ document: 1, createdAt: -1 });
LatexAssetSchema.index({ team: 1 });

const LatexAssetModel: Model<LatexAssetDocument> = mongoose.model<LatexAssetDocument>(
    'LatexAsset',
    LatexAssetSchema
);

export default LatexAssetModel;
