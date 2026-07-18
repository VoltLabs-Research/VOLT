import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema, Types } from 'mongoose';
import mongoose from 'mongoose';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export interface PopulatedWhiteboardUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
}

export type WhiteboardLastEditedBy = string | PopulatedWhiteboardUser | null;

export interface WhiteboardProps {
    team: string;
    createdBy: string;
    title: string;
    folder: string | null;
    storageClusterId?: string;
    payloadKey: string;
    thumbnailKey?: string;
    lastEditedBy?: string | PopulatedWhiteboardUser | null;
    createdAt: Date;
    updatedAt: Date;
}

export const requireWhiteboardStorageClusterId = (whiteboardId: string, storageClusterId?: string | null): string => {
    if (storageClusterId && storageClusterId.trim().length > 0) {
        return storageClusterId;
    }

    throw ApplicationError.conflict(
        'Whiteboard::StorageClusterRequired',
        `Whiteboard ${whiteboardId} does not have a storage cluster assigned`
    );
};

type WhiteboardRelations = 'team' | 'createdBy' | 'lastEditedBy';

type WhiteboardDocumentBase = Persistable<WhiteboardProps, WhiteboardRelations>;

export interface WhiteboardDocument extends Omit<WhiteboardDocumentBase, 'folder'>, Document {
    folder: Types.ObjectId | null;
}

const WhiteboardSchema: Schema<WhiteboardDocument> = new Schema({
    team: {
        ...teamRefField(true)
    },
    createdBy: {
        ...userRefField(true)
    },
    lastEditedBy: {
        ...userRefField(false),
        required: false,
        default: null
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
    payloadKey: {
        type: String,
        required: false,
        trim: true,
        default: ''
    },
    thumbnailKey: {
        type: String,
        required: false,
        trim: true
    },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'CatalogFolder',
        default: null,
        required: false
    }
}, {
    timestamps: true,
    minimize: false
});

WhiteboardSchema.index({ team: 1, folder: 1, createdAt: -1 });
WhiteboardSchema.index({ team: 1, title: 1 });

const WhiteboardModel: Model<WhiteboardDocument> = mongoose.model<WhiteboardDocument>(
    'Whiteboard',
    WhiteboardSchema
);

export default WhiteboardModel;
