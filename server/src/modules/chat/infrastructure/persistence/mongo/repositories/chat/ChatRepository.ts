import type { ChatProps } from '@modules/chat/domain/entities/chat/Chat';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import ChatDeletedEvent from '@modules/chat/domain/events/ChatDeletedEvent';
import type { IChatRepository, PersistedChatDTO } from '@modules/chat/domain/port/chat/IChatRepository';
import chatMapper from '@modules/chat/infrastructure/persistence/mongo/mappers/chat/ChatMapper';
import type { ChatDocument } from '@modules/chat/infrastructure/persistence/mongo/models/chat/ChatModel';
import ChatModel from '@modules/chat/infrastructure/persistence/mongo/models/chat/ChatModel';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { toPersistedEntity } from '@shared/domain/persisted/to-persisted-entity';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { inject } from 'tsyringe';

interface FindOrCreateChatParticipantsFilter {
    $all: [string, string];
}

interface FindOrCreateChatFilter {
    participants: FindOrCreateChatParticipantsFilter;
    team: string;
    isGroup: false;
}

@Singleton()
export default class ChatRepository
    extends MongooseBaseRepository<Chat, ChatProps, ChatDocument>
    implements IChatRepository {

    constructor(
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {
        super(ChatModel, chatMapper);
    }

    async findOrCreateChat(
        userId: string,
        targetUserId: string,
        teamId: string
    ): Promise<Chat> {
        const filter: FindOrCreateChatFilter = {
            participants: {
                $all: [userId, targetUserId]
            },
            team: teamId,
            isGroup: false
        };
        let chat = await this.model.findOne(filter);

        if (!chat) {
            chat = await this.model.create({
                participants: [userId, targetUserId],
                team: teamId,
                isActive: true,
                isGroup: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        // Ensure we return it populated
        await chat.populate('participants');

        return this.mapper.toDomain(chat);
    }

    async findChatsByUserId(userId: string): Promise<PersistedChatDTO[]> {
        const chats = await this.model.find({
            participants: userId,
            isActive: true
        })
            .populate('lastMessage')
            .populate('participants')
            .sort({ lastMessageAt: -1 });

        return chats.map((chat) => toPersistedEntity(this.mapper.toDomain(chat)));
    }

    async updateLastMessage(chatId: string, messageId: string): Promise<void> {
        await this.model.findByIdAndUpdate(chatId, {
            lastMessage: messageId,
            lastMessageAt: new Date()
        });
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id);

        if (result) {
            await this.eventBus.publish(new ChatDeletedEvent({
                chatId: id,
                teamId: result.team?.toString()
            }));
        }

        return !!result;
    }

    async removeUserReferences(userId: string): Promise<void> {
        await this.model.updateMany(
            { $or: [{ participants: userId }, { admins: userId }] },
            { $pull: { participants: userId, admins: userId } }
        );
    }

    async findIdsWithEmptyParticipants(): Promise<string[]> {
        const docs = await this.model
            .find({ participants: { $size: 0 } })
            .select('_id')
            .lean();

        return docs.map((doc) => String(doc._id));
    }
};
