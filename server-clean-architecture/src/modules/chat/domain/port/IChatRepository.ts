import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import Chat, { ChatProps } from "../entities/Chat";

export interface IChatRepository extends IBaseRepository<Chat, ChatProps>{
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
    findChatsByUserId(userId: string): Promise<ChatProps[]>;

    /**
     * Update last message for the specified chat id.
     */
    updateLastMessage(
        chatId: string,
        messageId: string
    ): Promise<void>;
};