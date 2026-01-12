import { ChatProps } from "../../../domain/entities/Chat";

export interface GetUserChatsInputDTO{
    userId: string;
};

export interface GetUserChatsOutputDTO extends ChatProps{}