import { CHAT_SOCKET_EVENTS } from '../../api/entities/shared/chat-constants';
import { PresenceStatus } from '../../api/entities/shared/chat-events';
import { CHAT_QUERY_KEYS, invalidateChatsQuery } from './queries';
import { updateChatInCache } from './queries';
import { useChatPresenceStore } from '../../stores/chat/use-chat-presence-store';
import { useQueryClient } from '@tanstack/react-query';
import useSocketEvent from '@/modules/socket/core/hooks/use-socket-event';
import type { ChatLastMessage } from '../../api/entities/chat';
import type { ChatMessage } from '../../api/entities/message';
import type { TypingUser, MessagesReadEvent } from '../../api/entities/shared/chat-events';

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

interface GroupChatEvent {
    chatId: string;
};

interface UseChatSocketOptions {
    currentChatId?: string;
    addMessage: (message: ChatMessage) => void;
    updateMessage: (_id: string, updates: Partial<ChatMessage>) => void;
};

const useChatSocket = ({ currentChatId, addMessage, updateMessage }: UseChatSocketOptions): void => {
    const queryClient = useQueryClient();
    const setTypingUser = useChatPresenceStore((state) => state.setTypingUser);
    const setUsersPresence = useChatPresenceStore((state) => state.setUsersPresence);
    const buildLastMessage = (message: ChatMessage): ChatLastMessage => ({
        _id: message._id,
        content: message.content,
        sender: message.sender,
        createdAt: message.createdAt
    });

    useSocketEvent<NewMessageEvent>(CHAT_SOCKET_EVENTS.NEW_MESSAGE, ({ chatId, message }) => {
        if (chatId === currentChatId) {
            addMessage(message);
        }
        updateChatInCache(queryClient, chatId, {
            lastMessage: buildLastMessage(message),
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

    useSocketEvent<Record<string, PresenceStatus.Online | PresenceStatus.Offline>>(
        CHAT_SOCKET_EVENTS.USERS_PRESENCE_INFO,
        (presenceMap) => {
            setUsersPresence(presenceMap);
        }
    );

    useSocketEvent<GroupChatEvent>(CHAT_SOCKET_EVENTS.GROUP_CREATED, () => {
        invalidateChatsQuery(queryClient).catch(() => undefined);
    });

    useSocketEvent<GroupChatEvent>(CHAT_SOCKET_EVENTS.USERS_ADDED_TO_GROUP, ({ chatId }) => {
        invalidateChatsQuery(queryClient).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.detail(chatId) }).catch(() => undefined);
    });

    useSocketEvent<GroupChatEvent>(CHAT_SOCKET_EVENTS.USERS_REMOVED_FROM_GROUP, ({ chatId }) => {
        invalidateChatsQuery(queryClient).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.detail(chatId) }).catch(() => undefined);
    });

    useSocketEvent<GroupChatEvent>(CHAT_SOCKET_EVENTS.GROUP_INFO_UPDATED, ({ chatId }) => {
        invalidateChatsQuery(queryClient).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.detail(chatId) }).catch(() => undefined);
    });

    useSocketEvent<GroupChatEvent>(CHAT_SOCKET_EVENTS.USER_LEFT_GROUP, ({ chatId }) => {
        invalidateChatsQuery(queryClient).catch(() => undefined);
        queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEYS.detail(chatId) }).catch(() => undefined);
    });
};

export default useChatSocket;
