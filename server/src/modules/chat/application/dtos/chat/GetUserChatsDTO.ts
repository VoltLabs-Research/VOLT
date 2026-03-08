import { PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';

export interface GetUserChatsInputDTO{
    userId: string;
};

export interface GetUserChatsOutputDTO extends PersistedChatDTO{}
