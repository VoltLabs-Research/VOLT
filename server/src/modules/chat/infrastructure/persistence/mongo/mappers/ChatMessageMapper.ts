import ChatMessage, { ChatMessageProps } from '@modules/chat/domain/entities/ChatMessage';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { ChatMessageDocument } from '@modules/chat/infrastructure/persistence/mongo/models/ChatMessageModel';

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

export default ChatMessageMapper;