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

import { create } from 'zustand';
import type { Chat, Message, TypingUser } from '@/types/chat';
import type { User } from '@/types/models';
import { chatApi } from '@/services/chat-api';
import { socketService } from '@/services/socketio';

interface ChatStore {
    // State
    chats: Chat[];
    currentChat: Chat | null;
    messages: Message[];
    teamMembers: User[];
    typingUsers: TypingUser[];
    isLoading: boolean;
    isConnected: boolean;

    // Actions
    setCurrentChat: (chat: Chat | null) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    updateMessage: (messageId: string, updates: Partial<Message>) => void;
    setTypingUsers: (users: TypingUser[]) => void;
    setLoading: (loading: boolean) => void;
    setConnected: (connected: boolean) => void;

    // API Actions
    loadChats: () => Promise<void>;
    loadTeamMembers: (teamId: string) => Promise<void>;
    loadMessages: (chatId: string) => Promise<void>;
    sendMessage: (content: string, messageType?: string, metadata?: any) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    toggleReaction: (messageId: string, emoji: string) => Promise<void>;
    markAsRead: (chatId: string) => Promise<void>;
    getOrCreateChat: (teamId: string, participantId: string) => Promise<Chat>;

    // Socket Actions
    joinChat: (chatId: string) => void;
    leaveChat: (chatId: string) => void;
    startTyping: (chatId: string) => void;
    stopTyping: (chatId: string) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
    // Initial state
    chats: [],
    currentChat: null,
    messages: [],
    teamMembers: [],
    typingUsers: [],
    isLoading: false,
    isConnected: false,

    // Basic setters
    setCurrentChat: (chat) => set({ currentChat: chat }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({
        messages: [...state.messages, message]
    })),
    updateMessage: (messageId, updates) => set((state) => ({
        messages: state.messages.map(msg => 
            msg._id === messageId ? { ...msg, ...updates } : msg
        )
    })),
    setTypingUsers: (users) => set({ typingUsers: users }),
    setLoading: (loading) => set({ isLoading: loading }),
    setConnected: (connected) => set({ isConnected: connected }),

    // API Actions
    loadChats: async () => {
        set({ isLoading: true });
        try {
            const chats = await chatApi.getChats();
            set({ chats, isLoading: false });
        } catch (error) {
            console.error('Failed to load chats:', error);
            set({ isLoading: false });
        }
    },

    loadTeamMembers: async (teamId) => {
        try {
            const members = await chatApi.getTeamMembers(teamId);
            set({ teamMembers: members });
        } catch (error) {
            console.error('Failed to load team members:', error);
        }
    },

    loadMessages: async (chatId) => {
        set({ isLoading: true });
        try {
            const messages = await chatApi.getChatMessages(chatId);
            set({ messages, isLoading: false });
        } catch (error) {
            console.error('Failed to load messages:', error);
            set({ isLoading: false });
        }
    },

    sendMessage: async (content, messageType = 'text', metadata) => {
        const { currentChat } = get();
        if (!currentChat) return;

        try {
            // Use socket to send message for real-time communication
            const { socketService } = await import('@/services/socketio');
            if (socketService.isConnected()) {
                socketService.emit('send_message', {
                    chatId: currentChat._id,
                    content,
                    messageType,
                    metadata
                }).catch((error) => {
                    console.error('Failed to send message:', error);
                });
            } else {
                console.error('Socket not connected');
            }
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    },

    editMessage: async (messageId, content) => {
        const { currentChat } = get();
        if (!currentChat) return;
        try {
            const updated = await chatApi.editMessage(currentChat._id, messageId, content);
            set((state) => ({
                messages: state.messages.map(m => m._id === messageId ? updated : m)
            }));
            if (socketService.isConnected()) {
                socketService.emit('edit_message', { chatId: currentChat._id, messageId, content }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to edit message:', error);
        }
    },

    deleteMessage: async (messageId) => {
        const { currentChat } = get();
        if (!currentChat) return;
        try {
            await chatApi.deleteMessage(currentChat._id, messageId);
            set((state) => ({
                messages: state.messages.map(m => m._id === messageId ? { ...m, deleted: true } : m)
            }));
            if (socketService.isConnected()) {
                socketService.emit('delete_message', { chatId: currentChat._id, messageId }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
        }
    },

    toggleReaction: async (messageId, emoji) => {
        const { currentChat } = get();
        if (!currentChat) return;
        try {
            const updated = await chatApi.toggleReaction(currentChat._id, messageId, emoji);
            set((state) => ({
                messages: state.messages.map(m => m._id === messageId ? updated : m)
            }));
            if (socketService.isConnected()) {
                socketService.emit('toggle_reaction', { chatId: currentChat._id, messageId, emoji }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to toggle reaction:', error);
        }
    },

    markAsRead: async (chatId) => {
        try {
            await chatApi.markMessagesAsRead(chatId);
        } catch (error) {
            console.error('Failed to mark messages as read:', error);
        }
    },

    getOrCreateChat: async (teamId, participantId) => {
        try {
            const chat = await chatApi.getOrCreateChat(teamId, participantId);
            return chat;
        } catch (error) {
            console.error('Failed to get or create chat:', error);
            throw error;
        }
    },

    // Socket Actions
    joinChat: (chatId) => {
        if (socketService.isConnected()) {
            socketService.emit('join_chat', chatId).catch((error) => {
                console.error('Failed to join chat:', error);
            });
        }
    },

    leaveChat: (chatId) => {
        if (socketService.isConnected()) {
            socketService.emit('leave_chat', chatId).catch((error) => {
                console.error('Failed to leave chat:', error);
            });
        }
    },

    startTyping: (chatId) => {
        if (socketService.isConnected()) {
            socketService.emit('typing_start', { chatId }).catch((error) => {
                console.error('Failed to start typing:', error);
            });
        }
    },

    stopTyping: (chatId) => {
        if (socketService.isConnected()) {
            socketService.emit('typing_stop', { chatId }).catch((error) => {
                console.error('Failed to stop typing:', error);
            });
        }
    }
}));