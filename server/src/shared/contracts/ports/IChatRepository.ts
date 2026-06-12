/**
 * Neutral, cross-module repository-port + persisted-DTO contract for the Chat
 * domain. Extracted from `@modules/chat/domain/port/chat/IChatRepository` during
 * the detachable-modules migration so consumers (dashboard, …) inject/type
 * against a contract rather than `@modules/chat`.
 *
 * The chat entity/props classes are NOT part of the neutral contracts layer, so
 * the port + DTO are GENERIC over them. The owner module re-exports bound
 * aliases so existing importers compile unchanged.
 *
 * Pure type — no runtime footprint, no `@modules/*` import.
 */
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export type PersistedChatDTO<TChatProps = unknown> = TChatProps & {
    _id: string;
};

export interface IChatRepository<TChat = unknown, TChatProps = unknown>
    extends IBaseRepository<TChat, TChatProps> {
    findOrCreateChat(
        userId: string,
        targetUserId: string,
        teamId: string
    ): Promise<TChat>;

    findChatsByUserId(userId: string): Promise<PersistedChatDTO<TChatProps>[]>;

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
