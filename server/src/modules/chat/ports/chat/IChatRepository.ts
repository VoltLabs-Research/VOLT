/**
 * The canonical definitions now live in the neutral contracts layer
 * (`@shared/contracts/ports/IChatRepository`) for the detachable-modules
 * migration (consumed by dashboard). The port + DTO are generic over the
 * entity/props; this module binds them to the concrete `Chat`/`ChatProps` and
 * re-exports so existing importers of this module path compile unchanged.
 */
import type {
    IChatRepository as IChatRepositoryContract,
    PersistedChatDTO as PersistedChatDTOContract
} from '@shared/contracts/ports/IChatRepository';
import type { ChatProps } from '@modules/chat/entities/chat/Chat';
import type Chat from '@modules/chat/entities/chat/Chat';

export type PersistedChatDTO = PersistedChatDTOContract<ChatProps>;

export type IChatRepository = IChatRepositoryContract<Chat, ChatProps>;
