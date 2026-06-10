interface ChatIdentifierValue {
    toString(): string;
}

export interface ChatUserReference {
    _id?: ChatIdentifierValue;
    toString(): string;
}

export type ChatParticipant = string | ChatUserReference;

export interface ChatProps {
    participants: ChatParticipant[];
    team: string;
    lastMessage: string;
    lastMessageAt: Date;
    isActive: boolean;
    updatedAt: Date;
    createdAt: Date;

    // Group chat fields
    isGroup: boolean;
    groupName: string;
    groupDescription: string;
    admins: string[];
    createdBy: string;
}

export default class Chat {
    constructor(
        public _id: string,
        public props: ChatProps
    ){}

    public isAdmin(userId: string): boolean {
        return this.props.admins.includes(userId);
    }
}
