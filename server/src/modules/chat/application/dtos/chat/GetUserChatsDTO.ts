import { PersistedChatDTO } from '@modules/chat/domain/port/IChatRepository';

export interface GetUserChatsInputDTO{
    userId: string;
};

export interface GetUserChatsOutputDTO extends PersistedChatDTO{}
