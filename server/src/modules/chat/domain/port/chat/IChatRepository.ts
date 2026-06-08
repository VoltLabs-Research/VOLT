import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Chat from '@modules/chat/domain/entities/chat/Chat';
import type { ChatProps } from '@modules/chat/domain/entities/chat/Chat';

export interface PersistedChatDTO extends ChatProps {
    _id: string;
}

export interface IChatRepository extends IBaseRepository<Chat, ChatProps> {
    findOrCreateChat(
        userId: string, 
        targetUserId: string,
        teamId: string
    ): Promise<Chat>;

    findChatsByUserId(userId: string): Promise<PersistedChatDTO[]>;

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
}
