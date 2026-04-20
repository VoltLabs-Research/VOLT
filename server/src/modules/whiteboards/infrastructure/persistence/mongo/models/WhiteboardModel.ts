import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema, Types } from 'mongoose';
import mongoose from 'mongoose';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum WhiteboardRelation {
    Team = 'team',
    CreatedBy = 'createdBy',
    LastEditedBy = 'lastEditedBy'
};

type WhiteboardDocumentBase = Persistable<WhiteboardProps, `${WhiteboardRelation}`>;

export interface WhiteboardDocument extends Omit<WhiteboardDocumentBase, 'folder'>, Document {
    folder: Types.ObjectId | null;
};

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
