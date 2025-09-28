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
import useAuthStore from '@/stores/authentication';
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
    sendFileMessage: (file: File) => Promise<void>;
    editMessage: (messageId: string, content: string) => Promise<void>;
    deleteMessage: (messageId: string) => Promise<void>;
    toggleReaction: (messageId: string, emoji: string) => Promise<void>;
    
    // Group management
    createGroupChat: (teamId: string, groupName: string, groupDescription: string, participantIds: string[]) => Promise<void>;
    addUsersToGroup: (chatId: string, userIds: string[]) => Promise<void>;
    removeUsersFromGroup: (chatId: string, userIds: string[]) => Promise<void>;
    updateGroupInfo: (chatId: string, groupName?: string, groupDescription?: string) => Promise<void>;
    updateGroupAdmins: (chatId: string, userIds: string[], action: 'add' | 'remove') => Promise<void>;
    leaveGroup: (chatId: string) => Promise<void>;
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

    sendFileMessage: async (file) => {
        const { currentChat } = get();
        if (!currentChat) return;

        try {
            // Upload file first
            const fileData = await chatApi.uploadFile(currentChat._id, file);
            
            // Use socket to send file message for real-time communication
            const { socketService } = await import('@/services/socketio');
            if (socketService.isConnected()) {
                socketService.emit('send_file_message', {
                    chatId: currentChat._id,
                    ...fileData
                }).catch((error) => {
                    console.error('Failed to send file message:', error);
                });
            } else {
                console.error('Socket not connected');
            }
        } catch (error) {
            console.error('Failed to send file message:', error);
        }
    },

    editMessage: async (messageId, content) => {
        const { currentChat } = get();
        if (!currentChat) {
            return;
        }
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
        const { currentChat, messages } = get();
        if (!currentChat) {
            return;
        }
        
        // Find the message to delete for optimistic update
        const messageToDelete = messages.find(m => m._id === messageId);
        if (!messageToDelete) {
            console.error('Message not found for deletion');
            return;
        }
        
        // Apply optimistic update immediately
        set((state) => ({
            messages: state.messages.map(m => m._id === messageId ? { ...m, deleted: true } : m)
        }));
        
        try {
            await chatApi.deleteMessage(currentChat._id, messageId);
            if (socketService.isConnected()) {
                socketService.emit('delete_message', { chatId: currentChat._id, messageId }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
            // Revert optimistic update on error
            set((state) => ({
                messages: state.messages.map(m => m._id === messageId ? messageToDelete : m)
            }));
        }
    },

    toggleReaction: async (messageId, emoji) => {
        const { currentChat, messages } = get();
        if (!currentChat) {
            console.error('No current chat found');
            return;
        }
        console.log('Store toggleReaction called:', messageId, emoji, currentChat._id);
        
        // Optimistic update
        const currentMessage = messages.find(m => m._id === messageId);
        if (!currentMessage) {
            console.error('Message not found for optimistic update');
            return;
        }

        const currentReactions = currentMessage.reactions || [];
        // Get user from auth store
        const authStore = useAuthStore.getState();
        const currentUser = authStore.user;
        if (!currentUser) {
            console.error('User not found');
            return;
        }
        const userId = currentUser._id;

        // Remove user from all existing reactions first
        const filteredReactions = currentReactions.map(reaction => ({
            ...reaction,
            users: reaction.users.filter(u => {
                const uId = typeof u === 'string' ? u : u._id;
                return uId !== userId;
            })
        })).filter(reaction => reaction.users.length > 0);

        // Check if user is removing their current reaction
        const currentUserReaction = currentReactions.find(reaction => 
            reaction.users.some(u => {
                const uId = typeof u === 'string' ? u : u._id;
                return uId === userId;
            })
        );

        let newReactions;
        if (currentUserReaction && currentUserReaction.emoji === emoji) {
            // User is removing their current reaction
            newReactions = filteredReactions;
            console.log('Optimistic: User removing their current reaction');
        } else {
            // User is adding a new reaction (or changing their reaction)
            const existingEmojiIndex = filteredReactions.findIndex(r => r.emoji === emoji);
            
            if (existingEmojiIndex !== -1) {
                // Add user to existing emoji reaction (only if not already there)
                const existingUsers = filteredReactions[existingEmojiIndex].users;
                const userAlreadyExists = existingUsers.some(u => {
                    const uId = typeof u === 'string' ? u : u._id;
                    return uId === userId;
                });
                
                if (!userAlreadyExists) {
                    filteredReactions[existingEmojiIndex].users.push(userId);
                }
                newReactions = filteredReactions;
                console.log('Optimistic: Added user to existing emoji reaction');
            } else {
                // Create new emoji reaction - ensure no duplicates by checking if emoji already exists
                const emojiAlreadyExists = filteredReactions.some(r => r.emoji === emoji);
                if (!emojiAlreadyExists) {
                    newReactions = [...filteredReactions, { emoji, users: [userId] }];
                    console.log('Optimistic: Created new emoji reaction');
                } else {
                    // This shouldn't happen, but fallback to filtered reactions
                    newReactions = filteredReactions;
                    console.log('Optimistic: Emoji already exists, using filtered reactions');
                }
            }
        }

        // Apply optimistic update immediately
        set((state) => ({
            messages: state.messages.map(m => 
                m._id === messageId 
                    ? { ...m, reactions: newReactions }
                    : m
            )
        }));

        try {
            // Use only socket for real-time reactions
            if (socketService.isConnected()) {
                socketService.emit('toggle_reaction', { chatId: currentChat._id, messageId, emoji }).catch(() => {});
            } else {
                console.error('Socket not connected');
                // Revert optimistic update if socket is not connected
                set((state) => ({
                    messages: state.messages.map(m => m._id === messageId ? currentMessage : m)
                }));
            }
        } catch (error) {
            console.error('Failed to toggle reaction:', error);
            // Revert optimistic update on error
            set((state) => ({
                messages: state.messages.map(m => m._id === messageId ? currentMessage : m)
            }));
        }
    },

    // Group management
    createGroupChat: async (teamId, groupName, groupDescription, participantIds) => {
        try {
            const groupChat = await chatApi.createGroupChat(teamId, groupName, groupDescription, participantIds);
            set((state) => ({
                chats: [...state.chats, groupChat]
            }));
            if (socketService.isConnected()) {
                socketService.emit('group_created', { chatId: groupChat._id }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to create group chat:', error);
        }
    },

    addUsersToGroup: async (chatId, userIds) => {
        try {
            const updatedChat = await chatApi.addUsersToGroup(chatId, userIds);
            set((state) => ({
                chats: state.chats.map(c => c._id === chatId ? updatedChat : c),
                currentChat: state.currentChat?._id === chatId ? updatedChat : state.currentChat
            }));
            if (socketService.isConnected()) {
                socketService.emit('users_added_to_group', { chatId, userIds }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to add users to group:', error);
        }
    },

    removeUsersFromGroup: async (chatId, userIds) => {
        try {
            const updatedChat = await chatApi.removeUsersFromGroup(chatId, userIds);
            set((state) => ({
                chats: state.chats.map(c => c._id === chatId ? updatedChat : c),
                currentChat: state.currentChat?._id === chatId ? updatedChat : state.currentChat
            }));
            if (socketService.isConnected()) {
                socketService.emit('users_removed_from_group', { chatId, userIds }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to remove users from group:', error);
        }
    },

    updateGroupInfo: async (chatId, groupName, groupDescription) => {
        try {
            const updatedChat = await chatApi.updateGroupInfo(chatId, groupName, groupDescription);
            set((state) => ({
                chats: state.chats.map(c => c._id === chatId ? updatedChat : c),
                currentChat: state.currentChat?._id === chatId ? updatedChat : state.currentChat
            }));
            if (socketService.isConnected()) {
                socketService.emit('group_info_updated', { chatId, groupName, groupDescription }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to update group info:', error);
        }
    },

    updateGroupAdmins: async (chatId, userIds, action) => {
        try {
            const updatedChat = await chatApi.updateGroupAdmins(chatId, userIds, action);
            set((state) => ({
                chats: state.chats.map(c => c._id === chatId ? updatedChat : c),
                currentChat: state.currentChat?._id === chatId ? updatedChat : state.currentChat
            }));
        } catch (error) {
            console.error('Failed to update group admins:', error);
        }
    },

    leaveGroup: async (chatId) => {
        try {
            await chatApi.leaveGroup(chatId);
            set((state) => ({
                chats: state.chats.filter(c => c._id !== chatId),
                currentChat: state.currentChat?._id === chatId ? null : state.currentChat
            }));
            if (socketService.isConnected()) {
                const { user } = useAuthStore.getState();
                socketService.emit('user_left_group', { chatId, userId: user?._id }).catch(() => {});
            }
        } catch (error) {
            console.error('Failed to leave group:', error);
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