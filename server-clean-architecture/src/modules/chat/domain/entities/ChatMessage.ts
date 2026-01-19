export enum ChatMessageType {
    Text = 'text',
    File = 'file',
    System = 'system'
};

export interface ChatMessageMetadata {
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    filePath: string;
};

export interface ChatReaction {
    emoji: string;
    users: string[];
};

export interface ChatMessageProps {
    chat: string;
    sender: any;
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
        public id: string,
        public props: ChatMessageProps
    ) { }

    public isSender(userId: string): boolean {
        const senderId = typeof this.props.sender === 'string'
            ? this.props.sender
            : this.props.sender._id?.toString() || this.props.sender.id?.toString() || this.props.sender.toString();

        return senderId === userId;
    }

    public isFile(): boolean {
        return this.props.messageType === ChatMessageType.File;
    }

    public toggleReaction(userId: string, emoji: string): void {
        // Remove the user from any existing reaction first (exclusive reaction logic)
        for (let i = this.props.reactions.length - 1; i >= 0; i--) {
            const reaction = this.props.reactions[i];
            const userIndex = reaction.users.findIndex(u => u.toString() === userId);

            if (userIndex !== -1) {
                // User found in this reaction, remove them
                reaction.users.splice(userIndex, 1);

                // If no users left in this reaction group, remove the group
                if (reaction.users.length === 0) {
                    this.props.reactions.splice(i, 1);
                }

                // If this was the same emoji, we are toggling off, so we're done
                if (reaction.emoji === emoji) {
                    return;
                }
            }
        }

        // Add new reaction
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