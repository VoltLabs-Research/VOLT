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

import { useEffect, useCallback, useRef } from 'react';
import { useChatStore } from '@/stores/chat';
import { socketService } from '@/services/socketio';
import useAuthStore from '@/stores/authentication';
import useTeamStore from '@/stores/team/team';
import { TokenStorage } from '@/utilities/storage';
import type { TypingUser, MessagesRead } from '@/types/chat';

export const useChat = () => {
    const {
        chats,
        currentChat,
        messages,
        teamMembers,
        typingUsers,
        isLoading,
        isConnected,
        setCurrentChat,
        setMessages,
        addMessage,
        setTypingUsers,
        setConnected,
        loadChats,
        loadTeamMembers,
        loadMessages,
        sendMessage,
        markAsRead,
        getOrCreateChat,
        joinChat,
        leaveChat,
        startTyping,
        stopTyping
    } = useChatStore();

    const { user } = useAuthStore();
    const { selectedTeam } = useTeamStore();
    const typingTimeoutRef = useRef<number | null>(null);

    // Initialize socket connection and authentication
    useEffect(() => {
        if (user) {
            // Get token from TokenStorage and update socket auth only if needed
            const token = TokenStorage.getToken();
            if (token) {
                // Only update auth if socket is not connected or token is different
                if (!socketService.isConnected() || socketService.getCurrentToken() !== token) {
                    console.log('[Chat] Updating socket authentication');
                    socketService.updateAuth({ token });
                }
            }
        }
    }, [user]);

    // Load chats when component mounts or team changes
    useEffect(() => {
        if (selectedTeam) {
            loadChats();
            loadTeamMembers(selectedTeam._id);
        }
    }, [selectedTeam, loadChats, loadTeamMembers]);

    // Socket event listeners
    useEffect(() => {
        let connectionUnsubscribe: (() => void) | null = null;
        let joinedChatUnsubscribe: (() => void) | null = null;
        let leftChatUnsubscribe: (() => void) | null = null;
        let newMessageUnsubscribe: (() => void) | null = null;
        let userTypingUnsubscribe: (() => void) | null = null;
        let messagesReadUnsubscribe: (() => void) | null = null;
        let errorUnsubscribe: (() => void) | null = null;

        const handleConnect = (connected: boolean) => {
            setConnected(connected);
            if (connected) {
                console.log('[Chat] Socket connected');
            } else {
                console.log('[Chat] Socket disconnected');
            }
        };

        const handleJoinedChat = (data: { chatId: string }) => {
            console.log('Joined chat:', data.chatId);
        };

        const handleLeftChat = (data: { chatId: string }) => {
            console.log('Left chat:', data.chatId);
        };

        const handleNewMessage = (data: { message: any; chatId: string }) => {
            console.log('[Chat] New message received:', data);
            // Only add message if it's for the current chat
            const { currentChat } = useChatStore.getState();
            if (currentChat && currentChat._id === data.chatId) {
                addMessage(data.message);
            }
        };

        const handleUserTyping = (data: TypingUser) => {
            const currentTypingUsers = useChatStore.getState().typingUsers;
            const filtered = currentTypingUsers.filter((u: TypingUser) => u.userId !== data.userId);
            if (data.isTyping) {
                setTypingUsers([...filtered, data]);
            } else {
                setTypingUsers(filtered);
            }
        };

        const handleMessagesRead = (data: MessagesRead) => {
            // Update message read status
            setMessages(messages.map(msg => ({
                ...msg,
                readBy: msg.readBy.map(user => user._id === data.readBy ? user : user)
            })));
        };

        const handleError = (error: string) => {
            console.error('Chat socket error:', error);
        };

        // Register event listeners
        connectionUnsubscribe = socketService.onConnectionChange(handleConnect);
        joinedChatUnsubscribe = socketService.on('joined_chat', handleJoinedChat);
        leftChatUnsubscribe = socketService.on('left_chat', handleLeftChat);
        newMessageUnsubscribe = socketService.on('new_message', handleNewMessage);
        userTypingUnsubscribe = socketService.on('user_typing', handleUserTyping);
        messagesReadUnsubscribe = socketService.on('messages_read', handleMessagesRead);
        errorUnsubscribe = socketService.on('error', handleError);

        // Initialize connection if not connected
        if (!socketService.isConnected()) {
            socketService.connect()
                .catch((error) => {
                    console.error('Failed to connect socket:', error);
                });
        } else {
            setConnected(true);
        }

        return () => {
            // Cleanup event listeners
            if (connectionUnsubscribe) connectionUnsubscribe();
            if (joinedChatUnsubscribe) joinedChatUnsubscribe();
            if (leftChatUnsubscribe) leftChatUnsubscribe();
            if (newMessageUnsubscribe) newMessageUnsubscribe();
            if (userTypingUnsubscribe) userTypingUnsubscribe();
            if (messagesReadUnsubscribe) messagesReadUnsubscribe();
            if (errorUnsubscribe) errorUnsubscribe();
        };
    }, [addMessage, setMessages, setTypingUsers, setConnected]);

    // Select a chat and load its messages
    const selectChat = useCallback(async (chat: any) => {
        if (currentChat?._id === chat._id) return;

        // Leave current chat if any
        if (currentChat) {
            leaveChat(currentChat._id);
        }

        setCurrentChat(chat);
        await loadMessages(chat._id);
        joinChat(chat._id);
        markAsRead(chat._id);
    }, [currentChat, setCurrentChat, loadMessages, joinChat, leaveChat, markAsRead]);

    // Create or get a chat with a team member
    const startChatWithMember = useCallback(async (member: any) => {
        if (!selectedTeam) return;

        try {
            const chat = await getOrCreateChat(selectedTeam._id, member._id);
            await selectChat(chat);
        } catch (error) {
            console.error('Failed to start chat with member:', error);
        }
    }, [selectedTeam, getOrCreateChat, selectChat]);

    // Send a message
    const handleSendMessage = useCallback(async (content: string) => {
        if (!content.trim() || !currentChat) return;

        await sendMessage(content);
    }, [currentChat, sendMessage]);

    // Handle typing indicators
    const handleTyping = useCallback((chatId: string) => {
        startTyping(chatId);

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set timeout to stop typing
        typingTimeoutRef.current = setTimeout(() => {
            stopTyping(chatId);
        }, 1000);
    }, [startTyping, stopTyping]);

    // Cleanup typing timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);

    return {
        // State
        chats,
        currentChat,
        messages,
        teamMembers,
        typingUsers,
        isLoading,
        isConnected,

        // Actions
        selectChat,
        startChatWithMember,
        handleSendMessage,
        handleTyping,
        loadChats
    };
};