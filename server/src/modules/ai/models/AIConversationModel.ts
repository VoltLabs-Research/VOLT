import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Document, Model, Schema } from 'mongoose';
import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

/** Persisted shape of an AI conversation (the Mongoose model is the record). */
export interface AIConversationProps {
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: Date | null;
    lastProvider?: string | null;
    lastModel?: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
}

type AIConversationRelations = 'userId' | 'teamId';

export interface AIConversationDocument extends Persistable<AIConversationProps, AIConversationRelations>, Document {}

const AIConversationSchema: Schema<AIConversationDocument> = new Schema({
    userId: {
        ...userRefField(true),
        index: true
    },
    teamId: {
        ...teamRefField(true),
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    lastMessageAt: {
        type: Date,
        default: null
    },
    lastProvider: {
        type: String,
        default: null
    },
    lastModel: {
        type: String,
        default: null
    },
    isArchived: {
        type: Boolean,
        default: false,
        index: true
    }
}, {
    timestamps: true
});

AIConversationSchema.index({
    teamId: 1,
    userId: 1,
    lastMessageAt: -1
});
AIConversationSchema.index({
    teamId: 1,
    userId: 1,
    updatedAt: -1
});

const AIConversationModel: Model<AIConversationDocument> = mongoose.model<AIConversationDocument>('AIConversation', AIConversationSchema);

export default AIConversationModel;
