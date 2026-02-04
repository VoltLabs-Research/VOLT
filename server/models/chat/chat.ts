import mongoose, { Schema, Model } from 'mongoose';
import { IChat } from '@/types/models/chat';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import { ValidationCodes } from '@/constants/validation-codes';

const ChatSchema: Schema<IChat> = new Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.CHAT_PARTICIPANTS_REQUIRED]
    }],
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, ValidationCodes.CHAT_TEAM_REQUIRED],
        inverse: { path: 'chats', behavior: 'addToSet' }
    },
    messages: [{
        type: Schema.Types.ObjectId,
        ref: 'Message',
        cascade: 'delete',
        inverse: { path: 'chat', behavior: 'set' }
    }],
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message'
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
        required: function() { return this.isGroup; }
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
        required: function() { return this.isGroup; }
    }
}, {
    timestamps: true
});

ChatSchema.index({ participants: 1, team: 1 }, { unique: false });
ChatSchema.index({ isGroup: 1 });
ChatSchema.index({ team: 1, isActive: 1 });

ChatSchema.plugin(useCascadeDelete);

const Chat: Model<IChat> = mongoose.model<IChat>('Chat', ChatSchema);

export default Chat;
