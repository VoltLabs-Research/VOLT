import { ChatProps } from "../../../domain/entities/Chat";

export interface GetOrCreateChatInputDTO{
    userId: string;
    targetUserId: string;
    teamId: string;
};

export interface GetOrCreateChatOutputDTO extends ChatProps{}