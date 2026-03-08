import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';

export interface AddUsersToGroupInputDTO {
    userId: string;
    chatId: string;
    userIds: string[];
};

export interface AddUsersToGroupOutputDTO extends PersistedChatDTO {};
