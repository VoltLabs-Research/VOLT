import { ChatMessageProps } from "../../../domain/entities/ChatMessage";

export interface EditMessageInputDTO{
    userId: string;
    messageId: string;
    content: string;
};

export interface EditMessageOutputDTO extends ChatMessageProps{}