import mongoose, { Schema, Model, Document } from 'mongoose';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { ChatMessageProps, ChatMessageType } from '@/src/modules/chat/domain/entities/ChatMessage';

type ChatMessageRelations = 'chat' | 'sender' | 'readBy' | 'deletedBy';
export interface ChatMessageDocument extends Persistable<ChatMessageProps, ChatMessageRelations>, Document{}

const MessageSchema: Schema<ChatMessageDocument> = new Schema({
    chat: {
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        required: true,
        inverse: { path: 'messages', behavior: 'addToSet' }
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
    isRead: {
        type: Boolean,
        default: false
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
    editedAt: {
        type: Date,
        default: null
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reactions: [
        new Schema({
            emoji: { type: String, required: true },
            users: [{ type: Schema.Types.ObjectId, ref: 'User' }]
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