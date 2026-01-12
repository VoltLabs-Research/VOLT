import Chat, { ChatProps } from "@/src/modules/chat/domain/entities/Chat";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";
import { ChatDocument } from "../models/ChatModel";

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