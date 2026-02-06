import { ChatProps } from '@modules/chat/domain/entities/Chat';

export interface AddUsersToGroupInputDTO{
    requesterId: string;
    chatId: string;
    userIdsToAdd: string[];
};

export interface AddUsersToGroupOutputDTO extends ChatProps{}