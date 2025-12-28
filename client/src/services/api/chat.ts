/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import VoltClient from '@/api';
import type { Chat, Message } from '@/types/chat';
import type { User } from '@/types/models';

const api = new VoltClient('/chat', { useRBAC: false });

export interface GetChatsResponse {
    status: string;
    data: Chat[];
}

export interface GetChatMessagesResponse {
    status: string;
    data: Message[];
}

export interface GetTeamMembersResponse {
    status: string;
    data: User[];
}

export interface SendMessageResponse {
    status: string;
    data: Message;
}

export const chatApi = {
    // Get all chats for the current user's teams
    getChats: async (): Promise<Chat[]> => {
        const response = await api.request<GetChatsResponse>('get', '/');
        return response.data.data;
    },

    // Get team members for chat initialization
    getTeamMembers: async (teamId: string): Promise<User[]> => {
        const response = await api.request<GetTeamMembersResponse>('get', `/teams/${teamId}/members`);
        return response.data.data;
    },

    // Get or create a chat between two users
    getOrCreateChat: async (teamId: string, participantId: string): Promise<Chat> => {
        const response = await api.request<{ status: string; data: Chat }>('get', `/teams/${teamId}/participants/${participantId}`);
        return response.data.data;
    },

    // Get messages for a specific chat
    getChatMessages: async (chatId: string, page = 1, limit = 50): Promise<Message[]> => {
        const response = await api.request<GetChatMessagesResponse>('get', `/${chatId}/messages`, {
            query: { page, limit }
        });
        return response.data.data;
    },

    // Send a message to a chat
    sendMessage: async (chatId: string, content: string, messageType = 'text', metadata?: any): Promise<Message> => {
        const response = await api.request<SendMessageResponse>('post', `/${chatId}/messages`, {
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
        await api.request('patch', `/${chatId}/read`);
    },

    // Edit a message
    editMessage: async (chatId: string, messageId: string, content: string): Promise<Message> => {
        const response = await api.request<{ status: string; data: Message }>('patch', `/${chatId}/messages/${messageId}`, {
            data: { content }
        });
        return response.data.data;
    },

    // Delete a message
    deleteMessage: async (chatId: string, messageId: string): Promise<void> => {
        await api.request('delete', `/${chatId}/messages/${messageId}`);
    },

    // Get file as base64 for preview
    getFilePreview: async (chatId: string, messageId: string): Promise<{ dataUrl: string; fileName: string; fileType: string; fileSize: number }> => {
        const response = await api.request<{ status: string; data: any }>('get', `/${chatId}/messages/${messageId}/preview`);
        return response.data.data;
    },

    // Upload file
    uploadFile: async (chatId: string, file: File): Promise<{ filename: string; originalName: string; size: number; mimetype: string; url: string }> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.request<{ status: string; data: any }>('post', `/${chatId}/upload`, {
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
        const response = await api.request<{ status: string; data: Message }>('post', `/${chatId}/send-file`, {
            data: fileData
        });
        return response.data.data;
    },

    // Group chat management
    createGroupChat: async (teamId: string, groupName: string, groupDescription: string, participantIds: string[]): Promise<Chat> => {
        const response = await api.request<{ status: string; data: Chat }>('post', '/groups', {
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
        const response = await api.request<{ status: string; data: Chat }>('post', `/${chatId}/groups/add-users`, {
            data: { userIds }
        });
        return response.data.data;
    },

    removeUsersFromGroup: async (chatId: string, userIds: string[]): Promise<Chat> => {
        const response = await api.request<{ status: string; data: Chat }>('post', `/${chatId}/groups/remove-users`, {
            data: { userIds }
        });
        return response.data.data;
    },

    updateGroupInfo: async (chatId: string, groupName?: string, groupDescription?: string): Promise<Chat> => {
        const response = await api.request<{ status: string; data: Chat }>('patch', `/${chatId}/groups/info`, {
            data: {
                groupName,
                groupDescription
            }
        });
        return response.data.data;
    },

    updateGroupAdmins: async (chatId: string, userIds: string[], action: 'add' | 'remove'): Promise<Chat> => {
        const response = await api.request<{ status: string; data: Chat }>('patch', `/${chatId}/groups/admins`, {
            data: {
                userIds,
                action
            }
        });
        return response.data.data;
    },

    leaveGroup: async (chatId: string): Promise<void> => {
        await api.request('post', `/${chatId}/groups/leave`);
    }
};
