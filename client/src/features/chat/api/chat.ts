import VoltClient from '@/api';
import type { Chat, Message } from '@/types/chat';
import type { User } from '@/types/models';
import type { GetChatMessagesResponse, GetTeamMembersResponse, GetChatsResponse, SendMessageResponse } from '@/features/chat/types';

const chatsClient = new VoltClient('/chats', { useRBAC: false });
const messagesClient = new VoltClient('/chat-messages', { useRBAC: false });

export const chatApi = {
    // Get all chats for the current user's teams
    getChats: async (): Promise<Chat[]> => {
        const response = await chatsClient.request<GetChatsResponse>('get', '/');
        return response.data.data;
    },

    // Get team members for chat initialization
    getTeamMembers: async (teamId: string): Promise<User[]> => {
        // TODO: Use teamApi
        const tmClient = new VoltClient('/team/members', { useRBAC: true });
        const response = await tmClient.request<any>('get', '/');
        const users = response.data.data.data.map((member) => member.user);
        return users;
    },

    // Get or create a chat between two users
    getOrCreateChat: async (teamId: string, participantId: string): Promise<Chat> => {
        const response = await chatsClient.request<{ status: string; data: Chat }>('get', `/teams/${teamId}/participants/${participantId}`);
        return response.data.data;
    },

    // Get messages for a specific chat
    getChatMessages: async (chatId: string, page = 1, limit = 50): Promise<Message[]> => {
        const response = await messagesClient.request<GetChatMessagesResponse>('get', `/${chatId}/messages`, {
            query: { page, limit }
        });
        return response.data.data.data;
    },

    // Send a message to a chat
    sendMessage: async (
        chatId: string,
        content: string,
        messageType: 'text' | 'file' | 'system' = 'text',
        metadata?: Message['metadata']
    ): Promise<Message> => {
        const response = await messagesClient.request<SendMessageResponse>('post', `/${chatId}/messages`, {
            data: {
                content,
                messageType,
                metadata
            }
        });
        return response.data.data;
    },

    // Mark messages as read
    markMessagesAsRead: async (chatId: string): Promise<void> => {
        await messagesClient.request('patch', `/${chatId}/read`);
    },

    // Edit a message
    editMessage: async (chatId: string, messageId: string, content: string): Promise<Message> => {
        const response = await messagesClient.request<{ status: string; data: Message }>('patch', `/${chatId}/messages/${messageId}`, {
            data: { content }
        });
        return response.data.data;
    },

    // Delete a message
    deleteMessage: async (chatId: string, messageId: string): Promise<void> => {
        await messagesClient.request('delete', `/${chatId}/messages/${messageId}`);
    },

    // Get file as base64 for preview
    getFilePreview: async (chatId: string, messageId: string): Promise<{ dataUrl: string; fileName: string; fileType: string; fileSize: number }> => {
        const response = await messagesClient.request<{
            status: 'success';
            data: { dataUrl: string; fileName: string; fileType: string; fileSize: number };
        }>('get', `/files/${messageId}`);
        return response.data.data;
    },

    // Upload file
    uploadFile: async (chatId: string, file: File): Promise<{ filename: string; originalName: string; size: number; mimetype: string; url: string }> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await messagesClient.request<{
            status: 'success';
            data: { filename: string; originalName: string; size: number; mimetype: string; url: string };
        }>('post', `/${chatId}/upload`, {
            data: formData,
            config: {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            }
        });
        return response.data.data;
    },

    // Send file message
    sendFileMessage: async (chatId: string, fileData: { filename: string; originalName: string; size: number; mimetype: string; url: string }): Promise<Message> => {
        const response = await messagesClient.request<{ status: string; data: Message }>('post', `/${chatId}/send-file`, {
            data: fileData
        });
        return response.data.data;
    },

    // Group chat management
    createGroupChat: async (teamId: string, groupName: string, groupDescription: string, participantIds: string[]): Promise<Chat> => {
        const response = await chatsClient.request<{ status: string; data: Chat }>('post', '/groups', {
            data: {
                teamId,
                groupName,
                groupDescription,
                participantIds
            }
        });
        return response.data.data;
    },

    addUsersToGroup: async (chatId: string, userIds: string[]): Promise<Chat> => {
        const response = await chatsClient.request<{ status: string; data: Chat }>('post', `/${chatId}/groups/add-user`, {
            data: { userIds }
        });
        return response.data.data;
    },

    removeUsersFromGroup: async (chatId: string, userIds: string[]): Promise<Chat> => {
        const response = await chatsClient.request<{ status: string; data: Chat }>('post', `/${chatId}/groups/remove-users`, {
            data: { userIds }
        });
        return response.data.data;
    },

    updateGroupInfo: async (chatId: string, groupName?: string, groupDescription?: string): Promise<Chat> => {
        const response = await chatsClient.request<{ status: string; data: Chat }>('patch', `/${chatId}/groups/info`, {
            data: {
                groupName,
                groupDescription
            }
        });
        return response.data.data;
    },

    updateGroupAdmins: async (chatId: string, userIds: string[], action: 'add' | 'remove'): Promise<Chat> => {
        const response = await chatsClient.request<{ status: string; data: Chat }>('patch', `/${chatId}/groups/admins`, {
            data: {
                userIds,
                action
            }
        });
        return response.data.data;
    },

    leaveGroup: async (chatId: string): Promise<void> => {
        await chatsClient.request('patch', `/${chatId}/groups/leave`);
    }
};

