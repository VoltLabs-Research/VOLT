import Chat, { ChatProps } from '@modules/chat/domain/entities/Chat';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { ChatDocument } from '@modules/chat/infrastructure/persistence/mongo/models/ChatModel';

class ChatMapper extends BaseMapper<Chat, ChatProps, ChatDocument>{
    constructor(){
        super(Chat, [
            'participants',
            'team',
            'messages',
            'admins',
            'createdBy',
            'lastMessage'            
        ]);
    }
};

export default new ChatMapper();