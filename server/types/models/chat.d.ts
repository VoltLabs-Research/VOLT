import { Document } from 'mongoose';

export interface IChat extends Document {
    participants: mongoose.Types.ObjectId[];
    team: mongoose.Types.ObjectId;
    messages: mongoose.Types.ObjectId[];
    lastMessage?: mongoose.Types.ObjectId;
    lastMessageAt?: Date;
    isActive: boolean;
    isGroup: boolean;
    groupName?: string;
    groupDescription?: string;
    groupAvatar?: string;
    admins: mongoose.Types.ObjectId[];
    createdBy?: mongoose.Types.ObjectId;
}

export interface IMessage extends Document {
    chat: mongoose.Types.ObjectId;
    sender: mongoose.Types.ObjectId;
    content: string;
    messageType: 'text' | 'file' | 'system';
    isRead: boolean;
    readBy: mongoose.Types.ObjectId[];
    metadata?: {
        fileName?: string;
        fileSize?: number;
        fileType?: string;
        fileUrl?: string;
        filePath?: string;
    };
    editedAt?: Date | null;
    deleted?: boolean;
    deletedAt?: Date | null;
    deletedBy?: mongoose.Types.ObjectId | null;
    reactions?: { emoji: string; users: mongoose.Types.ObjectId[] }[];
}
