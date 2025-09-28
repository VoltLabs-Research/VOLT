/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { api } from './api';
import type { Chat, Message } from '@/types/chat';
import type { User } from '@/types/models';

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
        const response = await api.get<GetChatsResponse>('/chat');
        return response.data.data;
    },

    // Get team members for chat initialization
    getTeamMembers: async (teamId: string): Promise<User[]> => {
        const response = await api.get<GetTeamMembersResponse>(`/chat/teams/${teamId}/members`);
        return response.data.data;
    },

    // Get or create a chat between two users
    getOrCreateChat: async (teamId: string, participantId: string): Promise<Chat> => {
        const response = await api.get<{ status: string; data: Chat }>(`/chat/teams/${teamId}/participants/${participantId}`);
        return response.data.data;
    },

    // Get messages for a specific chat
    getChatMessages: async (chatId: string, page = 1, limit = 50): Promise<Message[]> => {
        const response = await api.get<GetChatMessagesResponse>(`/chat/${chatId}/messages`, {
            params: { page, limit }
        });
        return response.data.data;
    },

    // Send a message to a chat
    sendMessage: async (chatId: string, content: string, messageType = 'text', metadata?: any): Promise<Message> => {
        const response = await api.post<SendMessageResponse>(`/chat/${chatId}/messages`, {
            content,
            messageType,
            metadata
        });
        return response.data.data;
    },

    // Mark messages as read
    markMessagesAsRead: async (chatId: string): Promise<void> => {
        await api.patch(`/chat/${chatId}/read`);
    },

    // Edit a message
    editMessage: async (chatId: string, messageId: string, content: string): Promise<Message> => {
        const response = await api.patch<{ status: string; data: Message }>(`/chat/${chatId}/messages/${messageId}`, { content });
        return response.data.data;
    },

    // Delete a message
    deleteMessage: async (chatId: string, messageId: string): Promise<void> => {
        await api.delete(`/chat/${chatId}/messages/${messageId}`);
    },

    // Toggle reaction
    toggleReaction: async (chatId: string, messageId: string, emoji: string): Promise<Message> => {
        const response = await api.post<{ status: string; data: Message }>(`/chat/${chatId}/messages/${messageId}/reactions`, { emoji });
        return response.data.data;
    }
};
