import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

interface PopulatedLatexUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export interface LatexDocumentProps {
    team: string;
    title: string;
    storageClusterId?: string;
    createdBy: string | PopulatedLatexUser;
    lastEditedBy?: string | PopulatedLatexUser | null;
    folder: string | null;
    createdAt: Date;
    updatedAt: Date;
}

type LatexDocumentRelations = 'team' | 'createdBy' | 'lastEditedBy';

type LatexDocumentDocumentBase = Persistable<LatexDocumentProps, LatexDocumentRelations>;

export interface LatexDocumentDocument extends Omit<LatexDocumentDocumentBase, 'folder'>, Document {
    folder: Types.ObjectId | null;
}

const LatexDocumentSchema: Schema<LatexDocumentDocument> = new Schema({
    team: {
        ...teamRefField(true)
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    storageClusterId: {
        type: String,
        required: false,
        trim: true
    },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'CatalogFolder',
        default: null,
        required: false
    },
    createdBy: {
        ...userRefField(true)
    },
    lastEditedBy: {
        ...userRefField(false),
        required: false,
        default: null
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
