export interface ChatProps {
    participants: any[];
    team: string;
    lastMessage: string;
    lastMessageAt: Date;
    isActive: boolean;
    updatedAt: Date;
    createdAt: Date;

    // Group chat fields
    // TODO: maybe another entity for this?
    isGroup: boolean;
    groupName: string;
    groupDescription: string;
    groupAvatar: string;
    admins: string[];
    createdBy: string;
};

export default class Chat {
    constructor(
        public id: string,
        public props: ChatProps
    ) { }

    public isAdmin(userId: string): boolean {
        return this.props.admins.includes(userId);
    }
};