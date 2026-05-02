import type { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';

export interface UpdateGroupInfoInputDTO {
    userId: string;
    chatId: string;
    groupName?: string;
    groupDescription?: string;
}

export interface UpdateGroupInfoOutputDTO extends PersistedChatDTO {}
