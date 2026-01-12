import { ChatMessageProps } from "../../../domain/entities/ChatMessage";

export interface FileDataInput{
    filename: string;
    originalName: string;
    size: number;
    mimetype: string;
    url: string;
};

export interface SendFileMessageInputDTO{
    userId: string;
    chatId: string;
    fileData: FileDataInput;
};

export interface SendFileMessageOutputDTO extends ChatMessageProps{}