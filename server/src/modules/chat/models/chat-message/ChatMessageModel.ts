import { ValidationCodes } from '@core/constants/validation-codes';
import mongoose, { Schema, Model, Document } from 'mongoose';
import type { ChatUserReference } from '@shared/contracts/types/Chat';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

import { ChatMessageType } from '@volt/contracts/modules/chat/domain';
import type { ChatMessageMetadata } from '@volt/contracts/modules/chat/domain';

export { ChatMessageType };
export type { ChatMessageMetadata };

export interface ChatReaction {
    emoji: string;
    users: string[];
}

export interface ChatMessageProps {
    chat: string;
    sender: string | ChatUserReference;
    content: string;
    messageType: ChatMessageType;
    readBy: string[];
    metadata: ChatMessageMetadata;
    deleted: boolean;
    reactions: ChatReaction[];
    createdAt: Date;
    updatedAt: Date;
}

enum ChatMessageRelation {
    Chat = 'chat',
    Sender = 'sender',
    ReadBy = 'readBy'
}

type ChatMessageRelationKey = `${ChatMessageRelation}`;

export interface ChatMessageDocument extends Persistable<ChatMessageProps, ChatMessageRelationKey>, Document {}

const chatReactionEmojiField = {
    type: String,
    required: true
};

const chatReactionUsersField = {
    type: Schema.Types.ObjectId,
    ref: 'User'
};

const MessageSchema: Schema<ChatMessageDocument> = new Schema({
    chat: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        required: true
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: [true, ValidationCodes.MESSAGE_CONTENT_REQUIRED],
        trim: true,
        maxlength: [2000, ValidationCodes.MESSAGE_CONTENT_MAXLEN]
    },
    messageType: {
        type: String,
        enum: Object.values(ChatMessageType),
        default: ChatMessageType.Text
    },
    readBy: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    metadata: {
        fileName: String,
        fileSize: Number,
        fileType: String,
        fileUrl: String,
        filePath: String
    },
    deleted: {
        type: Boolean,
        default: false
    },
    reactions: [
        new Schema({
            emoji: chatReactionEmojiField,
            users: [
                chatReactionUsersField
            ]
        }, { _id: false })
    ]
}, {
    timestamps: true
});

MessageSchema.index({ chat: 1, createdAt: -1 });
MessageSchema.index({ sender: 1 });
MessageSchema.index({ readBy: 1 });
MessageSchema.index({ 'reactions.emoji': 1 });
MessageSchema.index({ content: 'text' });

const ChatMessageModel: Model<ChatMessageDocument> = mongoose.model<ChatMessageDocument>('ChatMessage', MessageSchema);

export default ChatMessageModel;
