import { PaginatedResult } from "@/src/shared/domain/IBaseRepository";
import { ChatMessageProps } from "../../../domain/entities/ChatMessage";

export interface GetChatMessagesInputDTO{
    userId: string;
    chatId: string;
};

export interface GetChatMessagesOutputDTO extends PaginatedResult<ChatMessageProps>{}