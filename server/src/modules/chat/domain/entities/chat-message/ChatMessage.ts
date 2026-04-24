import type { ChatUserReference } from '@modules/chat/domain/entities/chat/Chat';

export enum ChatMessageType {
    Text = 'text',
    File = 'file'
};

export interface ChatMessageMetadata {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    filePath: string;
};

interface ChatReaction {
    emoji: string;
    users: string[];
};

export interface ChatMessageProps {
    chat: string;
    sender: string | ChatUserReference;
    content: string;
    messageType: ChatMessageType;
    isRead: boolean;
    readBy: string[];
    metadata: ChatMessageMetadata;
    editedAt: Date;
    deleted: boolean;
    deletedAt: Date;
    deletedBy: string;
    reactions: ChatReaction[];
    createdAt: Date;
    updatedAt: Date;
};

export default class ChatMessage {
    constructor(
        public _id: string,
        public props: ChatMessageProps
    ){}

    public isSender(userId: string): boolean {
        let senderId = this.props.sender.toString();

        if (typeof this.props.sender === 'string') {
            senderId = this.props.sender;
        } else if (this.props.sender._id) {
            senderId = this.props.sender._id.toString();
        }

        return senderId === userId;
    }

    public toggleReaction(userId: string, emoji: string): void {
        for (let i = this.props.reactions.length - 1; i >= 0; i--) {
            const reaction = this.props.reactions[i];
            const userIndex = reaction.users.findIndex(u => u.toString() === userId);

            if (userIndex !== -1) {
                reaction.users.splice(userIndex, 1);

                if (reaction.users.length === 0) {
                    this.props.reactions.splice(i, 1);
                }

                if (reaction.emoji === emoji) {
                    return;
                }
            }
        }

        const existingReactionIndex = this.props.reactions.findIndex((r) => r.emoji === emoji);

        if (existingReactionIndex !== -1) {
            this.props.reactions[existingReactionIndex].users.push(userId);
        } else {
            this.props.reactions.push({
                emoji,
                users: [userId]
            });
        }
    }
};
