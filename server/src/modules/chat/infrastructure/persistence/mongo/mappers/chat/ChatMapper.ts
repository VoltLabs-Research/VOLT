import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import type { ChatProps } from '@modules/chat/domain/entities/chat/Chat';
import type { ChatDocument } from '@modules/chat/infrastructure/persistence/mongo/models/chat/ChatModel';

export default createMongoMapper<Chat, ChatProps, ChatDocument>(Chat, [
    'participants',
    'team',
    'admins',
    'createdBy',
    'lastMessage'
]);
