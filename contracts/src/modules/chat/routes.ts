import { get, post, put, patch, del } from '../../shared/routing';
import type {
    GetOrCreateDirectChatInput,
    CreateGroupChatInput,
    AddUsersToGroupInput,
    UpdateGroupInfoInput,
    UpdateGroupAdminsInput,
    SendChatMessageInput,
    EditMessageInput
} from './http';
import type { Chat, ChatMessage } from './domain';

export const chatRoutes = {
    
    listUserChats: get<Chat[]>('/api/chats'),
    getOrCreate: post<GetOrCreateDirectChatInput, Chat>('/api/chats/direct'),
    createGroup: post<CreateGroupChatInput, Chat>('/api/chats/groups'),
    addUsersToGroup: post<AddUsersToGroupInput, Chat>('/api/chats/:chatId/users'),
    removeUsersFromGroup: del<Chat>('/api/chats/:chatId/users'),
    updateGroupInfo: patch<UpdateGroupInfoInput, Chat>('/api/chats/:chatId'),
    updateGroupAdmins: patch<UpdateGroupAdminsInput, Chat>('/api/chats/:chatId/admins'),
    leaveGroup: del('/api/chats/:chatId/participants/self'),

    
    listMessages: get<ChatMessage>('/api/chats/:chatId/messages'),
    sendMessage: post<SendChatMessageInput, ChatMessage>('/api/chats/:chatId/messages'),
    markMessagesAsRead: patch<never, void>('/api/chats/:chatId/messages/read-status'),
    editMessage: patch<EditMessageInput, ChatMessage>('/api/chats/:chatId/messages/:messageId'),
    deleteMessage: del('/api/chats/:chatId/messages/:messageId'),
    setMessageReaction: put<never, ChatMessage>('/api/chats/:chatId/messages/:messageId/reactions/:emoji'),
    removeMessageReaction: del<ChatMessage>('/api/chats/:chatId/messages/:messageId/reactions/:emoji'),
    sendFileMessage: post<never, ChatMessage>('/api/chats/:chatId/messages/file')
} as const;
