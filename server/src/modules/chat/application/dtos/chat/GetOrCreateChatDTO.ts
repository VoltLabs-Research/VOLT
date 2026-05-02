import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';

export interface GetOrCreateChatInputDTO {
    userId: string;
    targetUserId: string;
    teamId: string;
}

export interface GetOrCreateChatOutputDTO extends PersistedChatDTO {}
