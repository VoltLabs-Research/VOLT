import { ChatProps } from '@modules/chat/domain/entities/Chat';

export interface UpdateGroupInfoInputDTO{
    userId: string;
    chatId: string;
    groupName?: string;
    groupDescription?: string;
};

export interface UpdateGroupInfoOutputDTO extends ChatProps{}