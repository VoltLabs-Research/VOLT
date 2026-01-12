import ChatMessage, { ChatMessageProps } from "@/src/modules/chat/domain/entities/ChatMessage";
import { BaseMapper } from "@/src/shared/infrastructure/persistence/mongo/MongoBaseMapper";
import { ChatMessageDocument } from "../models/ChatMessageModel";

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