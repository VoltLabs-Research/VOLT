import { ChatMessageMetadata } from "../../../domain/entities/ChatMessage";

export interface GetFilePreviewInputDTO{
    userId: string;
    filename: string;
    chatId?: string;
};

export interface GetFilePreviewOutputDTO{
    stream: NodeJS.ReadableStream;
    stat: {
        size: number;
        metadata: ChatMessageMetadata
    };
};