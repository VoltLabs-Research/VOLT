/**
 * The participant structural types now live in the neutral contracts layer
 * (`@shared/contracts/types/Chat`) for the detachable-modules migration
 * (consumed by dashboard). Re-exported here so existing importers of this module
 * path compile unchanged.
 */
import type { ChatParticipant } from '@shared/contracts/types/Chat';

export type { ChatIdentifierValue, ChatUserReference, ChatParticipant } from '@shared/contracts/types/Chat';

export interface ChatProps {
    participants: ChatParticipant[];
    team: string;
    lastMessage: string;
    lastMessageAt: Date;
    isActive: boolean;
    updatedAt: Date;
    createdAt: Date;

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
