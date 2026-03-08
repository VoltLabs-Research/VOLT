import { ChatProps } from '@modules/chat/domain/entities/Chat';

export interface RemoveUsersFromGroupInputDTO{
    userId: string;
    chatId: string;
    userIds: string[];
};

export interface RemoveUsersFromGroupOutputDTO extends ChatProps{
    _id: string;
}
