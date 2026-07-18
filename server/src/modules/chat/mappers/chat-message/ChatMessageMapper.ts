import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import ChatMessage from '@modules/chat/entities/chat-message/ChatMessage';
import type { ChatMessageProps } from '@modules/chat/entities/chat-message/ChatMessage';
import type { ChatMessageDocument } from '@modules/chat/models/chat-message/ChatMessageModel';

export default createMongoMapper<ChatMessage, ChatMessageProps, ChatMessageDocument>(ChatMessage, [
    'chat',
    'sender',
    'readBy'
]);
