import { IChatRepository } from '@modules/chat/domain/port/IChatRepository';
import Chat, { ChatProps } from '@modules/chat/domain/entities/Chat';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import ChatModel, { ChatDocument } from '@modules/chat/infrastructure/persistence/mongo/models/ChatModel';
import chatMapper from '@modules/chat/infrastructure/persistence/mongo/mappers/ChatMapper';
import { injectable, inject } from 'tsyringe';
import { IEventBus } from '@shared/application/events/IEventBus';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ChatDeletedEvent from '@modules/chat/domain/events/ChatDeletedEvent';

@injectable()
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
        let chat = await this.model.findOne({
            participants: { $all: [userId, targetUserId] },
            team: teamId,
            isGroup: false
        });

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

    async findChatsByUserId(userId: string): Promise<ChatProps[]> {
        const chats = await this.model.find({
            participants: userId,
            isActive: true
        })
            .populate('lastMessage')
            .populate('participants')
            .sort({ lastMessageAt: -1 });

        return chats.map((chat) => this.mapper.toDomain(chat).props)
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
}