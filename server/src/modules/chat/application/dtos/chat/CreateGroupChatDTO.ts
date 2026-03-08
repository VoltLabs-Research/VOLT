import { ChatProps } from '@modules/chat/domain/entities/Chat';

export interface CreateGroupChatInputDTO{
    userId: string;
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
};

export interface CreateGroupChatOutputDTO extends ChatProps{
    _id: string;
}
