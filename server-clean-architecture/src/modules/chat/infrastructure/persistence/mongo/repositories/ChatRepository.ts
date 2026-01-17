import { IChatRepository } from "@/src/modules/chat/domain/port/IChatRepository";
import Chat, { ChatProps } from "@/src/modules/chat/domain/entities/Chat";
import { MongooseBaseRepository } from "@/src/shared/infrastructure/persistence/mongo/MongooseBaseRepository";
import ChatModel, { ChatDocument } from "../models/ChatModel";
import chatMapper from "../mappers/ChatMapper";
import { injectable, inject } from "tsyringe";
import { IEventBus } from "@/src/shared/application/events/IEventBus";
import { SHARED_TOKENS } from "@/src/shared/infrastructure/di/SharedTokens";
import ChatDeletedEvent from "../../../../domain/events/ChatDeletedEvent";

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
        const chat = await this.model.findOneAndUpdate(
            {
                participants: { $all: [userId, targetUserId] },
                team: teamId,
                isGroup: false
            },
            {
                $setOnInsert: {
                    participants: [userId, targetUserId],
                    team: teamId,
                    isActive: true,
                    isGroup: false
                }
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                runValidators: true
            }
        );

        return this.mapper.toDomain(chat);
    }

    async findChatsByUserId(userId: string): Promise<ChatProps[]> {
        const chats = await this.model.find({
            participants: userId,
            isActive: true
        })
            .populate('lastMessage')
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