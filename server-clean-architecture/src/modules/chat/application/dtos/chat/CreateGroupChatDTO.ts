import { ChatProps } from "../../../domain/entities/Chat";

export interface CreateGroupChatInputDTO{
    ownerId: string;
    teamId: string;
    groupName: string;
    groupDescription?: string;
    participantIds: string[];
};

export interface CreateGroupChatOutputDTO extends ChatProps{}