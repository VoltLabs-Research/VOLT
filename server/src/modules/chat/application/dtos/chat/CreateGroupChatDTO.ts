import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';

export interface CreateGroupChatInputDTO {
    userId: string;
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
};

export interface CreateGroupChatOutputDTO extends PersistedChatDTO {};
