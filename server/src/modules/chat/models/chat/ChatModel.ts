import { ValidationCodes } from '@core/constants/validation-codes';
import { teamRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Schema, Model, Document } from 'mongoose';
import type { ChatParticipant } from '@shared/contracts/types/Chat';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

/**
 * Chat persisted shape. Formerly lived in `entities/chat/Chat` — inlined here
 * (pollium style) so the model is self-contained after the domain-entity layer
 * was removed. `participants`/`admins`/`createdBy`/`lastMessage` are stored as
 * refs; the persisted document types them as ObjectId(s) via `Persistable`.
 */
export interface ChatProps {
    participants: ChatParticipant[];
    team: string;
    lastMessage: string;
    lastMessageAt: Date;
    isActive: boolean;
    updatedAt: Date;
    createdAt: Date;

    isGroup: boolean;
    groupName: string;
    groupDescription: string;
    admins: string[];
    createdBy: string;
}

enum ChatRelation {
    Participants = 'participants',
    Team = 'team',
    Admins = 'admins',
    CreatedBy = 'createdBy',
    LastMessage = 'lastMessage'
}

type ChatRelationKey = `${ChatRelation}`;

export interface ChatDocument extends Persistable<ChatProps, ChatRelationKey>, Document {}

const ChatSchema: Schema<ChatDocument> = new Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.CHAT_PARTICIPANTS_REQUIRED]
    }],
    team: {
        ...teamRefField([true, ValidationCodes.CHAT_TEAM_REQUIRED])
    },
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'ChatMessage'
    },
    lastMessageAt: {
        type: Date
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String,
    },
    groupDescription: {
        type: String,
        default: ''
    },
    admins: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: function () { return this.isGroup; }
    }
}, {
    timestamps: true
});

ChatSchema.index({ participants: 1, team: 1 });

ChatSchema.index({ isGroup: 1 });
ChatSchema.index({ team: 1, isActive: 1 });

const ChatModel: Model<ChatDocument> = mongoose.model<ChatDocument>('Chat', ChatSchema);

export default ChatModel;
