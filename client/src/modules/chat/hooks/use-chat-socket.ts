import { useQueryClient } from '@tanstack/react-query';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { useChatPresenceStore } from '../stores';
import { CHAT_SOCKET_EVENTS } from '../api/entities/chat-constants';
import { updateChatInCache } from './chat/queries';
import type { ChatMessage } from '../api/entities/chat-message';
import type { TypingUser, MessagesReadEvent } from '../api/entities/chat-events';

interface NewMessageEvent {
    chatId: string;
    message: ChatMessage;
};

interface MessageEditedEvent {
    chatId: string;
    message: ChatMessage;
};

interface MessageDeletedEvent {
    chatId: string;
    messageId: string;
};

interface ReactionUpdatedEvent {
    chatId: string;
    message: ChatMessage;
};

interface UseChatSocketOptions {
    currentChatId?: string;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (_id: string, updates: Partial<ChatMessage>) => void;
}

const useChatSocket = ({ currentChatId, addMessage, updateMessage }: UseChatSocketOptions): void => {
    const queryClient = useQueryClient();
    const setTypingUser = useChatPresenceStore((state) => state.setTypingUser);
    const setUsersPresence = useChatPresenceStore((state) => state.setUsersPresence);

    useSocketEvent<NewMessageEvent>(CHAT_SOCKET_EVENTS.NEW_MESSAGE, ({ chatId, message }) => {
        if (chatId === currentChatId) {
            addMessage(message);
        }
        updateChatInCache(queryClient, chatId, {
            lastMessage: {
                _id: message._id,
                content: message.content,
                sender: message.sender,
                createdAt: message.createdAt
            },
            lastMessageAt: message.createdAt
        });
    });

    useSocketEvent<MessageEditedEvent>(CHAT_SOCKET_EVENTS.MESSAGE_EDITED, ({ chatId, message }) => {
        if (chatId === currentChatId) {
            updateMessage(message._id, message);
        }
    });

    useSocketEvent<MessageDeletedEvent>(CHAT_SOCKET_EVENTS.MESSAGE_DELETED, ({ chatId, messageId }) => {
        if (chatId === currentChatId) {
            updateMessage(messageId, { deleted: true });
        }
    });

    useSocketEvent<ReactionUpdatedEvent>(CHAT_SOCKET_EVENTS.REACTION_UPDATED, ({ chatId, message }) => {
        if (chatId === currentChatId) {
            updateMessage(message._id, { reactions: message.reactions });
        }
    });

    useSocketEvent<MessagesReadEvent>(CHAT_SOCKET_EVENTS.MESSAGES_READ, ({ chatId }) => {
        if (chatId === currentChatId) {
        }
    });

    useSocketEvent<TypingUser>(CHAT_SOCKET_EVENTS.USER_TYPING, (typing) => {
        if (typing.chatId === currentChatId) {
            setTypingUser(typing);
        }
    });

    useSocketEvent<Record<string, 'online' | 'offline'>>(
        CHAT_SOCKET_EVENTS.USERS_PRESENCE_INFO,
        (presenceMap) => {
            setUsersPresence(presenceMap);
        }
    );
};

export default useChatSocket;
