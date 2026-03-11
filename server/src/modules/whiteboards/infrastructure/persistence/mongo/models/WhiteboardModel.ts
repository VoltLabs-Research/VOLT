import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema } from 'mongoose';
import mongoose from 'mongoose';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum WhiteboardRelation {
    Team = 'team',
    CreatedBy = 'createdBy'
};

export interface WhiteboardDocument extends Persistable<WhiteboardProps, `${WhiteboardRelation}`>, Document {};

const WhiteboardSchema: Schema<WhiteboardDocument> = new Schema({
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
    payloadKey: {
        type: String,
        required: true,
        trim: true,
        default: ''
    },
    thumbnailKey: {
        type: String,
        required: false,
        trim: true
    },
    lastEditedAt: {
        type: Date,
        required: false
    }
}, {
    timestamps: true,
    minimize: false
});

WhiteboardSchema.index({ team: 1, createdAt: -1 });
WhiteboardSchema.index({ team: 1, title: 1 });

const WhiteboardModel: Model<WhiteboardDocument> = mongoose.model<WhiteboardDocument>(
    'Whiteboard',
    WhiteboardSchema
);

export default WhiteboardModel;
