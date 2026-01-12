import { IBaseRepository } from "@/src/shared/domain/IBaseRepository";
import ChatMessage, { ChatMessageProps } from "../entities/ChatMessage";

export interface IChatMessageRepository extends IBaseRepository<ChatMessage, ChatMessageProps>{
    /**
     * Mark a message as read.
     */
    markMessageAsRead(
        chatId: string,
        userId: string
    ): Promise<void>;
};