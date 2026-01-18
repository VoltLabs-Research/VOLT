import { ChatMessageMetadata } from '@modules/chat/domain/entities/ChatMessage';

export interface GetFilePreviewInputDTO{
    messageId: string;
};

export interface GetFilePreviewOutputDTO{
    dataUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
};