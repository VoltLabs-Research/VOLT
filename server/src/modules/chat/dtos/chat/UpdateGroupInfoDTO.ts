import type { PersistedChatDTO } from '@modules/chat/ports/chat/IChatRepository';

export interface UpdateGroupInfoInputDTO {
    userId: string;
    chatId: string;
    groupName?: string;
    groupDescription?: string;
}

export interface UpdateGroupInfoOutputDTO extends PersistedChatDTO {}
