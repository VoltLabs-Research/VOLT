import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IChatMessageRepository } from '@/src/modules/chat/domain/port/IChatMessageRepository';
import ChatMessage, { ChatMessageProps } from '@/src/modules/chat/domain/entities/ChatMessage';
import ChatMessageModel, { ChatMessageDocument } from '../models/ChatMessageModel';
import chatMessageMapper from '../mappers/ChatMessageMapper';

@injectable()
export default class ChatMessageRepository
    extends MongooseBaseRepository<ChatMessage, ChatMessageProps, ChatMessageDocument>
    implements IChatMessageRepository {

    constructor() {
        super(ChatMessageModel, new chatMessageMapper());
    }

    async markMessageAsRead(messageId: string, userId: string): Promise<void> {
        await this.model.findByIdAndUpdate(messageId, {
            $addToSet: { readBy: userId }
        });
    }

    async findByChatId(chatId: string, limit: number = 50, offset: number = 0): Promise<ChatMessage[]> {
        const docs = await this.model.find({ chat: chatId })
            .sort({ createdAt: -1 })
            .skip(offset)
            .limit(limit);

        return docs.map(doc => this.mapper.toDomain(doc));
    }
}
