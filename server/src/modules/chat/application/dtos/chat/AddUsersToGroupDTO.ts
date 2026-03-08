import { ChatProps } from '@modules/chat/domain/entities/Chat';

export interface AddUsersToGroupInputDTO{
    userId: string;
    chatId: string;
    userIds: string[];
};

export interface AddUsersToGroupOutputDTO extends ChatProps{
    _id: string;
}
