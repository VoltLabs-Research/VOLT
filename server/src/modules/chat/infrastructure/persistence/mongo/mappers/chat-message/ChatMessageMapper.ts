import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import ChatMessage from '@modules/chat/domain/entities/chat-message/ChatMessage';
import type { ChatMessageProps } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import type { ChatMessageDocument } from '@modules/chat/infrastructure/persistence/mongo/models/chat-message/ChatMessageModel';

class ChatMessageMapper extends BaseMapper<ChatMessage, ChatMessageProps, ChatMessageDocument>{
    constructor(){
        super(ChatMessage, [
            'chat',
            'sender',
            'readBy',
            'deletedBy'
        ]);
    }
};

export default new ChatMessageMapper();
