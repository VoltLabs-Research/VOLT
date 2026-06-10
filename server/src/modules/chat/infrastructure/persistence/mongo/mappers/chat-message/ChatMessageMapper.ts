import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import ChatMessage from '@modules/chat/domain/entities/chat-message/ChatMessage';
import type { ChatMessageProps } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import type { ChatMessageDocument } from '@modules/chat/infrastructure/persistence/mongo/models/chat-message/ChatMessageModel';

export default createMongoMapper<ChatMessage, ChatMessageProps, ChatMessageDocument>(ChatMessage, [
    'chat',
    'sender',
    'readBy'
]);
