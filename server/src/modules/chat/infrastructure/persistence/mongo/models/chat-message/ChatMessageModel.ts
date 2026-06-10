import { ValidationCodes } from '@core/constants/validation-codes';
import { ChatMessageType } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import mongoose, { Schema, Model, Document } from 'mongoose';
import type { ChatMessageProps } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

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
