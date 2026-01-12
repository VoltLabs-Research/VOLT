export enum ChatMessageType{
    Text = 'text',
    File = 'file',
    System = 'system'
};

export interface ChatMessageMetadata{
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    filePath: string;
};

export interface ChatReaction{
    emoji: string;
    users: string[];
};

export interface ChatMessageProps{
    chat: string;
    sender: string;
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

export default class ChatMessage{
    constructor(
        public id: string,
        public props: ChatMessageProps
    ){}

    public isSender(userId: string): boolean{
        return this.props.sender !== userId;
    }

    public toggleReaction(userId: string, emoji: string): void{
        const existingReactionIndex = this.props.reactions.findIndex((reaction) => reaction.emoji === emoji);
        if(existingReactionIndex === -1){
            this.props.reactions.push({
                emoji,
                users: [userId]
            });
            return;
        }

        const reaction = this.props.reactions[existingReactionIndex];
        const userIndex = reaction.users.indexOf(userId);
        if(userIndex === -1){
            reaction.users.push(userId);
            return;
        }

        reaction.users.splice(userIndex, 1);
        if(reaction.users.length === 0){
            this.props.reactions.splice(existingReactionIndex, 1);
        }
    }
};