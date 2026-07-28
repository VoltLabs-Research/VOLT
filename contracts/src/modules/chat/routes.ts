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
import type { Chat, ChatMessage } from './domain';

export const chatRoutes = {
    
    listUserChats: get<Chat[]>('/api/chats'),
    getOrCreate: post<never, Chat>('/api/chats/teams/:teamId/participants/:targetUserId'),
    createGroup: post<CreateGroupChatInput, Chat>('/api/chats/groups'),
    addUsersToGroup: post<AddUsersToGroupInput, Chat>('/api/chats/:chatId/users'),
    removeUsersFromGroup: del<Chat>('/api/chats/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoInput, Chat>('/api/chats/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsInput, Chat>('/api/chats/:chatId/admins'),
    leaveGroup: del('/api/chats/:chatId/participants/self'),

    
    listMessages: get<ChatMessage>('/api/chat-messages/:chatId/messages'),
    sendMessage: post<SendChatMessageInput, ChatMessage>('/api/chat-messages/:chatId/messages'),
    editMessage: patch<EditMessageInput, ChatMessage>('/api/chat-messages/:chatId/messages/:messageId'),
    deleteMessage: del('/api/chat-messages/:chatId/messages/:messageId'),
    markMessagesAsRead: patch<never, void>('/api/chat-messages/:chatId/messages/read'),
    toggleMessageReaction: patch<ToggleMessageReactionInput, ChatMessage>('/api/chat-messages/:chatId/messages/:messageId/reactions'),
    sendFileMessage: post<never, ChatMessage>('/api/chat-messages/:chatId/messages/file')
} as const;
