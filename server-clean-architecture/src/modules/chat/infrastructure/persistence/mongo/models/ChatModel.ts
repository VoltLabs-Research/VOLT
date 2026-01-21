import mongoose, { Schema, Model, Document } from 'mongoose';
import { ChatProps } from '@modules/chat/domain/entities/Chat';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { ValidationCodes } from '@core/constants/validation-codes';

type ChatRelations = 'participants' | 'team' | 'admins' | 'createdBy' | 'lastMessage';
export interface ChatDocument extends Persistable<ChatProps, ChatRelations>, Document { }

const ChatSchema: Schema<ChatDocument> = new Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.CHAT_PARTICIPANTS_REQUIRED]
    }],
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, ValidationCodes.CHAT_TEAM_REQUIRED]
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
    // Group chat fields
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
    groupAvatar: {
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

ChatSchema.index(
    { participants: 1, team: 1 },
    { unique: false }
);

ChatSchema.index({ isGroup: 1 });
ChatSchema.index({ team: 1, isActive: 1 });

const ChatModel: Model<ChatDocument> = mongoose.model<ChatDocument>('Chat', ChatSchema);

export default ChatModel;