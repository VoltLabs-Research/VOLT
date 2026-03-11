import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema } from 'mongoose';
import mongoose from 'mongoose';
import type { LatexAssetProps } from '@modules/latex/domain/entities/LatexAsset';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum LatexAssetRelation {
    Team = 'team',
    Document = 'document',
    CreatedBy = 'createdBy'
};

export interface LatexAssetDocument extends Persistable<LatexAssetProps, `${LatexAssetRelation}`>, Document {};

const LatexAssetSchema: Schema<LatexAssetDocument> = new Schema({
    team: {
        ...teamRefField(true),
        cascade: 'delete'
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
