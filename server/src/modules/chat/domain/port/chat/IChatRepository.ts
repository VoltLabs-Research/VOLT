import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import type { ChatProps } from '@modules/chat/domain/entities/chat/Chat';

export interface PersistedChatDTO extends ChatProps {
    _id: string;
};

export interface IChatRepository extends IBaseRepository<Chat, ChatProps> {
    /**
     * Verify if the user id already have a chat with target user id.
     * If not, create one.
     */
    findOrCreateChat(
        userId: string, 
        targetUserId: string,
        teamId: string
    ): Promise<Chat>;

    /**
     * Find chats for the specified user id.
     */
    findChatsByUserId(userId: string): Promise<PersistedChatDTO[]>;

    /**
     * Update last message for the specified chat id.
     */
    updateLastMessage(
        chatId: string,
        messageId: string
    ): Promise<void>;

    /**
     * Pull the given userId from participants and admins on every chat.
     */
    removeUserReferences(userId: string): Promise<void>;

    /**
     * Find ids of chats whose participants array is empty (eligible for deletion).
     */
    findIdsWithEmptyParticipants(): Promise<string[]>;
};
