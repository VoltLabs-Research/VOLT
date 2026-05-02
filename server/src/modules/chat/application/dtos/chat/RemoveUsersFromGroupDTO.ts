import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';

export interface RemoveUsersFromGroupInputDTO {
    userId: string;
    chatId: string;
    userIds: string[];
}

export interface RemoveUsersFromGroupOutputDTO extends PersistedChatDTO {}
