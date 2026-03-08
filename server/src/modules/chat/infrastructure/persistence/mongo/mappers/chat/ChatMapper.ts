import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import type { ChatProps } from '@modules/chat/domain/entities/chat/Chat';
import type { ChatDocument } from '@modules/chat/infrastructure/persistence/mongo/models/chat/ChatModel';

class ChatMapper extends BaseMapper<Chat, ChatProps, ChatDocument>{
    constructor(){
        super(Chat, [
            'participants',
            'team',
            'admins',
            'createdBy',
            'lastMessage'            
        ]);
    }
};

export default new ChatMapper();
