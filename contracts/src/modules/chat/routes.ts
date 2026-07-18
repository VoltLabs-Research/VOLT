import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateGroupChatInput,
    AddUsersToGroupInput,
    RemoveUsersFromGroupInput,
    UpdateGroupInfoInput,
    UpdateGroupAdminsInput,
    SendChatMessageInput,
    EditMessageInput,
    ToggleMessageReactionInput
} from './http';
import type { PersistedChat, PersistedChatMessage } from './domain';

/**
 * Every client-facing chat endpoint, typed by request/response. All paths are
 * the full wire paths matching the previous two `createHttpModule` groups
 * (`/api/chats` — team-membership on the `:teamId` route only — and
 * `/api/chat-messages`) verbatim. Order matters for the controller: the message
 * routes keep their original registration order so Express matches identically.
 */
export const chatRoutes = {
    // ---- Chats (`/api/chats`) ----
    listUserChats: get<PersistedChat[]>('/api/chats'),
    getOrCreate: post<never, PersistedChat>('/api/chats/teams/:teamId/participants/:targetUserId'),
    createGroup: post<CreateGroupChatInput, PersistedChat>('/api/chats/groups'),
    addUsersToGroup: post<AddUsersToGroupInput, PersistedChat>('/api/chats/:chatId/users'),
    removeUsersFromGroup: del<PersistedChat>('/api/chats/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoInput, PersistedChat>('/api/chats/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsInput, PersistedChat>('/api/chats/:chatId/admins'),
    leaveGroup: del('/api/chats/:chatId/participants/self'),

    // ---- Messages (`/api/chat-messages`) ----
    listMessages: get<PersistedChatMessage>('/api/chat-messages/:chatId/messages'),
    sendMessage: post<SendChatMessageInput, PersistedChatMessage>('/api/chat-messages/:chatId/messages'),
    editMessage: patch<EditMessageInput, PersistedChatMessage>('/api/chat-messages/:chatId/messages/:messageId'),
    deleteMessage: del('/api/chat-messages/:chatId/messages/:messageId'),
    markMessagesAsRead: patch<never, void>('/api/chat-messages/:chatId/messages/read'),
    toggleMessageReaction: patch<ToggleMessageReactionInput, PersistedChatMessage>('/api/chat-messages/:chatId/messages/:messageId/reactions'),
    sendFileMessage: post<never, PersistedChatMessage>('/api/chat-messages/:chatId/messages/file')
} as const;
