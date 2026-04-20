import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface CatalogFolderDocument extends Document {
    _id: Types.ObjectId;
    team: Types.ObjectId;
    createdBy: Types.ObjectId;
    title: string;
    parent: Types.ObjectId | null;
    kind: CatalogFolderKind;
    createdAt: Date;
    updatedAt: Date;
}

const CatalogFolderSchema = new Schema<CatalogFolderDocument>({
    team: {
        ...teamRefField(true)
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
        ref: 'CatalogFolder',
        default: null,
        required: false
    },
    kind: {
        type: String,
        enum: Object.values(CatalogFolderKind),
        required: true,
        index: true
    }
}, {
    timestamps: true
});

CatalogFolderSchema.index({ team: 1, kind: 1, parent: 1, createdAt: -1 });
CatalogFolderSchema.index({ team: 1, kind: 1, title: 1 });

const CatalogFolderModel: Model<CatalogFolderDocument> = mongoose.models.CatalogFolder
    || mongoose.model<CatalogFolderDocument>('CatalogFolder', CatalogFolderSchema);

export default CatalogFolderModel;
