import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { IChatMessageRepository } from '@modules/chat/domain/port/IChatMessageRepository';
import ChatMessage, { ChatMessageProps } from '@modules/chat/domain/entities/ChatMessage';
import ChatMessageModel, { ChatMessageDocument } from '@modules/chat/infrastructure/persistence/mongo/models/ChatMessageModel';
import chatMessageMapper from '@modules/chat/infrastructure/persistence/mongo/mappers/ChatMessageMapper';

@injectable()
export default class ChatMessageRepository
    extends MongooseBaseRepository<ChatMessage, ChatMessageProps, ChatMessageDocument>
    implements IChatMessageRepository {

    constructor() {
        super(ChatMessageModel, chatMessageMapper);
    }

    async create(data: ChatMessageProps): Promise<ChatMessage> {
        const persistenceData = this.mapper.toPersistence(data);
        const doc = await this.model.create(persistenceData);

        await doc.populate('sender');

        return this.mapper.toDomain(doc);
    }

    async markAllAsRead(chatId: string, userId: string): Promise<void> {
        await this.model.updateMany(
            {
                chat: chatId,
                readBy: { $ne: userId }
            },
            { $addToSet: { readBy: userId } }
        );
    }

}
