import type { ChatMessageType, ChatMessageMetadata } from '@/modules/chat/domain/entities';

export interface SendMessageDTO {
    content: string;
    messageType?: ChatMessageType;
    metadata?: ChatMessageMetadata;
};
