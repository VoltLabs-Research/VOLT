import ChatMessage from '@modules/chat/domain/entities/chat-message/ChatMessage';
import chatMessageMapper from '@modules/chat/infrastructure/persistence/mongo/mappers/chat-message/ChatMessageMapper';
import ChatMessageModel from '@modules/chat/infrastructure/persistence/mongo/models/chat-message/ChatMessageModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { ChatMessageProps } from '@modules/chat/domain/entities/chat-message/ChatMessage';
import type { IChatMessageRepository } from '@modules/chat/domain/port/chat-message/IChatMessageRepository';
import type { ChatMessageDocument } from '@modules/chat/infrastructure/persistence/mongo/models/chat-message/ChatMessageModel';

interface MarkMessagesAsReadFilter {
    chat: string;
    readBy: {
        $ne: string;
    };
};

interface MarkMessagesAsReadUpdate {
    $addToSet: {
        readBy: string;
    };
};

@Singleton()
export default class ChatMessageRepository
    extends MongooseBaseRepository<ChatMessage, ChatMessageProps, ChatMessageDocument>
    implements IChatMessageRepository {

    constructor() {
        super(ChatMessageModel, chatMessageMapper);
    }

    async create(data: Partial<ChatMessageProps>): Promise<ChatMessage> {
        const persistenceData = this.mapper.toPersistence(data);
        const doc = await this.model.create(persistenceData);

        await doc.populate('sender');

        return this.mapper.toDomain(doc);
    }

    async markAllAsRead(chatId: string, userId: string): Promise<void> {
        const filter: MarkMessagesAsReadFilter = {
            chat: chatId,
            readBy: {
                $ne: userId
            }
        };
        const update: MarkMessagesAsReadUpdate = {
            $addToSet: {
                readBy: userId
            }
        };

        await this.model.updateMany(
            filter,
            update
        );
    }

};
