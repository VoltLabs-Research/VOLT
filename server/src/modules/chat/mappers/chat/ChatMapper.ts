import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';
import Chat from '@modules/chat/entities/chat/Chat';
import type { ChatProps } from '@modules/chat/entities/chat/Chat';
import type { ChatDocument } from '@modules/chat/models/chat/ChatModel';

export default createMongoMapper<Chat, ChatProps, ChatDocument>(Chat, [
    'participants',
    'team',
    'admins',
    'createdBy',
    'lastMessage'
]);
