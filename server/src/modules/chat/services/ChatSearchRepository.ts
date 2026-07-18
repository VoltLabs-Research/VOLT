import { CHAT_CONTRACT_TOKENS } from '@shared/contracts/tokens/ChatTokens';
import ChatModel from '@modules/chat/models/chat/ChatModel';
import { Singleton } from '@shared/infrastructure/di/decorators';

/**
 * Cross-module read/cascade adapter registered under the neutral
 * `Symbol.for('ChatRepository')` token so the dashboard global-search use case
 * can list a user's chats — and the `team.deleted` cascade can bulk-delete a
 * team's chats — without importing `@modules/chat` internals. Model-backed (no
 * entity / mapper / domain repository); exposes only the `findChatsByUserId`
 * the search consumer reads and the `deleteMany` the cascade factory calls. The
 * chat module's own code talks to {@link ChatModel} directly via
 * {@link import('@modules/chat/services/ChatService').default}.
 */
@Singleton(CHAT_CONTRACT_TOKENS.ChatRepository)
export class ChatSearchRepository {
    async findChatsByUserId(userId: string): Promise<Array<Record<string, unknown>>> {
        const chats = await ChatModel.find({ participants: userId, isActive: true })
            .populate('lastMessage')
            .populate('participants')
            .sort({ lastMessageAt: -1 })
            .lean()
            .exec();

        return chats.map((chat) => ({ ...chat, _id: String(chat._id) }));
    }

    async deleteMany(filter: Record<string, unknown>): Promise<number> {
        const result = await ChatModel.deleteMany(filter);
        return result.deletedCount ?? 0;
    }
}
