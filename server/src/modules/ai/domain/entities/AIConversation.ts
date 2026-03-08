export interface AIConversationProps {
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: Date | null;
    lastProvider?: string | null;
    lastModel?: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export default class AIConversation {
    constructor(
        public _id: string,
        public props: AIConversationProps
    ) {}
};
