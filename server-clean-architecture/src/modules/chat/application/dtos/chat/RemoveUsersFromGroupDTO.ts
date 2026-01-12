import { ChatProps } from "../../../domain/entities/Chat";

export interface RemoveUsersFromGroupInputDTO{
    requesterId: string;
    chatId: string;
    userIdsToRemove: string[];
};

export interface RemoveUsersFromGroupOutputDTO extends ChatProps{}