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

import type { RefObject } from 'react';
import { socketService } from '@/services/websockets/socketio';
import { useChatStore } from '@/features/chat/stores';
import type { MessagesRead, TypingUser } from '@/types/chat';

const SOCKET_EVENTS = {
    JOINED_CHAT: 'joined_chat',
    LEFT_CHAT: 'left_chat',
    NEW_MESSAGE: 'new_message',
    USER_TYPING: 'user_typing',
    MESSAGES_READ: 'messages_read',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    REACTION_UPDATED: 'reaction_updated',
    USER_PRESENCE_UPDATE: 'user_presence_update',
    USERS_PRESENCE_INFO: 'users_presence_info',
    ERROR: 'error'
} as const;

// singleton
export default class ChatSocketManager {
    private static instance: ChatSocketManager | null = null;

    constructor(
        private registered = false,
        private unsubscribers: Array<() => void> = [],
        private refCount = 0
    ) { }

    static getInstance(): ChatSocketManager {
        if (!ChatSocketManager.instance) {
            ChatSocketManager.instance = new ChatSocketManager();
        }
        return ChatSocketManager.instance;
    }

    register(currentChatIdRef: RefObject<string | null>): void {
        this.refCount++;

        if (this.registered) {
            console.log(`[Chat] Socket listeners already registered(refs: ${this.refCount})`);
            return;
        }

        console.log('[Chat] Registering socket listeners');
        this.registered = true;

        this.setupConnectionHandler();
        this.setupEventHandlers(currentChatIdRef);
        this.ensureConnection();
    }

    unregister(): void {
        this.refCount--;
        console.log(`[Chat] Unregister called(refs remaining: ${this.refCount})`);

        if (this.refCount <= 0) {
            this.cleanup();
        }
    }

    private setupConnectionHandler(): void {
        const unsubscribe = socketService.onConnectionChange((connected: boolean) => {
            useChatStore.getState().setConnected(connected);
            console.log(`[Chat] Socket ${connected ? 'connected' : 'disconnected'}`);
        });

        this.unsubscribers.push(unsubscribe);
    }

    private setupEventHandlers(currentChatIdRef: RefObject<string | null>): void {
        const handlers = this.createEventHandlers(currentChatIdRef);

        Object.entries(handlers).forEach(([event, handler]) => {
            // @ts-ignore
            const unsubscribe = socketService.on(event, handler);
            this.unsubscribers.push(unsubscribe);
        });
    }

    private handleUserTyping = (data: TypingUser): void => {
        const { typingUsers, setTypingUsers } = useChatStore.getState();
        const filteredUsers = typingUsers.filter((u: TypingUser) => u.userId !== data.userId);

        setTypingUsers(data.isTyping ? [...filteredUsers, data] : filteredUsers);
    }

    private handleMessagesRead = (data: MessagesRead): void => {
        const { messages, setMessages } = useChatStore.getState();

        const updatedMessages = messages.map((msg) => {
            const alreadyRead = msg.readBy.some((u) => u._id === data.readBy);

            return alreadyRead
                ? msg
                : { ...msg, readBy: [...msg.readBy, { _id: data.readBy } as any] };
        });

        setMessages(updatedMessages);
    }

    private createMessageEditedHandler(currentChatIdRef: RefObject<string | null>) {
        return (payload: { chatId: string; message: any }): void => {
            if (currentChatIdRef.current !== payload.chatId) return;
            const { messages, setMessages } = useChatStore.getState();
            setMessages(messages.map((m) => m._id === payload.message._id ? payload.message : m));
        };
    }

    private createMessageDeletedHandler(currentChatIdRef: RefObject<string | null>) {
        return (payload: { chatId: string; messageId: string }): void => {
            if (currentChatIdRef.current !== payload.chatId) return;

            const { messages, setMessages } = useChatStore.getState();
            setMessages(messages.map((m) => m._id === payload.messageId ? { ...m, deleted: true } as any : m));
        };
    }

    private createReactionUpdatedHandler(currentChatIdRef: RefObject<string | null>) {
        return (payload: { chatId: string; message: any }): void => {
            if (currentChatIdRef.current !== payload.chatId || !payload.message) return;
            const { messages, setMessages } = useChatStore.getState();
            const updatedMessage = this.deduplicateReactions(payload.message);
            setMessages(messages.map((m) => m._id === updatedMessage._id ? updatedMessage : m));
        };
    }

    private deduplicateReactions(message: any): any {
        if (!message.reactions || !Array.isArray(message.reactions)) {
            return message;
        }

        const seenEmojis = new Set<string>();
        const uniqueReactions = message.reactions.filter((reaction: any) => {
            if (seenEmojis.has(reaction.emoji)) return false;
            seenEmojis.add(reaction.emoji);
            return true;
        });

        return { ...message, reactions: uniqueReactions };
    }

    private handleUserPresenceUpdate = (payload: {
        userId: string;
        status: 'online' | 'offline';
        timestamp: string
    }): void => {
        useChatStore.getState().setUserPresence(payload.userId, payload.status);
    }

    private handleUsersPresenceInfo = (data: Record<string, 'online' | 'offline'>): void => {
        useChatStore.getState().setUsersPresence(data);
    }

    private handleError = (error: string): void => {
        console.error('[Chat] Socket error:', error);
    }

    private ensureConnection(): void {
        if (!socketService.isConnected()) {
            socketService.connect().catch((error) => {
                console.error('[Chat] Failed to connect socket:', error);
            });
        } else {
            useChatStore.getState().setConnected(true);
        }
    }

    private cleanup(): void {
        console.log('[Chat] Cleaning up socket listeners(last ref)');

        this.unsubscribers.forEach((unsubscribe) => {
            try {
                unsubscribe();
            } catch (error) {
                console.error('[Chat] Error during unsubscribe:', error);
            }
        });

        this.unsubscribers = [];
        this.registered = false;
        this.refCount = 0;
    }

    private createNewMessageHandler(currentChatIdRef: RefObject<string | null>) {
        return (data: { message: any, chatId: string }): void => {
            console.log('[Chat] New message received:', data);

            if (currentChatIdRef.current === data.chatId) {
                useChatStore.getState().addMessage(data.message);
            }
        }
    }

    private handleJoinedChat(data: any): void {
        console.log('[Chat] Joined chat:', data.chatId);
    }

    private handleLeftChat(data: any): void {
        console.log('[Chat] Left chat:', data.chatId);
    }

    private createEventHandlers(currentChatIdRef: RefObject<string | null>) {
        return {
            [SOCKET_EVENTS.JOINED_CHAT]: this.handleJoinedChat,
            [SOCKET_EVENTS.LEFT_CHAT]: this.handleLeftChat,
            [SOCKET_EVENTS.NEW_MESSAGE]: this.createNewMessageHandler(currentChatIdRef),
            [SOCKET_EVENTS.USER_TYPING]: this.handleUserTyping,
            [SOCKET_EVENTS.MESSAGES_READ]: this.handleMessagesRead,
            [SOCKET_EVENTS.MESSAGE_EDITED]: this.createMessageEditedHandler(currentChatIdRef),
            [SOCKET_EVENTS.MESSAGE_DELETED]: this.createMessageDeletedHandler(currentChatIdRef),
            [SOCKET_EVENTS.REACTION_UPDATED]: this.createReactionUpdatedHandler(currentChatIdRef),
            [SOCKET_EVENTS.USER_PRESENCE_UPDATE]: this.handleUserPresenceUpdate,
            [SOCKET_EVENTS.USERS_PRESENCE_INFO]: this.handleUsersPresenceInfo,
            [SOCKET_EVENTS.ERROR]: this.handleError
        };
    }
};
