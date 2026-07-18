import type { PersistedChatDTO } from '@modules/chat/ports/chat/IChatRepository';

export interface GetOrCreateChatInputDTO {
    userId: string;
    targetUserId: string;
    teamId: string;
}

export interface GetOrCreateChatOutputDTO extends PersistedChatDTO {}
