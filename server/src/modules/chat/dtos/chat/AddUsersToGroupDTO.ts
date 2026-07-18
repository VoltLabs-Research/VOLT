import type { PersistedChatDTO } from '@modules/chat/ports/chat/IChatRepository';

export interface AddUsersToGroupInputDTO {
    userId: string;
    chatId: string;
    userIds: string[];
}

export interface AddUsersToGroupOutputDTO extends PersistedChatDTO {}
