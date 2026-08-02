import { SOCKET_CHAT_EVENTS } from '@/modules/socket/events/chat';
import { PresenceStatus } from '@volt/contracts/modules/chat/domain';
import { invalidateChatsQuery, updateChatInCache } from './queries';
import { addMessageToCache, updateMessageInCache } from '../message/queries';
import { useChatPresenceStore } from '../../store/chat/use-chat-presence-store';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';
import type { TypingUser } from '@volt/contracts/modules/chat/domain';

interface ChatMessageEvent {
    chatId: string;
    message: ChatMessage;
}

const useChatListRefreshOn = (event: string): void => {
    useSocketEvent(event, () => {
        invalidateChatsQuery().catch(() => undefined);
    });
};

const useChatSocket = (currentChatId: string | null): void => {
    const setTypingUser = useChatPresenceStore((state) => state.setTypingUser);
    const setUsersPresence = useChatPresenceStore((state) => state.setUsersPresence);

    useSocketEvent<ChatMessageEvent>(SOCKET_CHAT_EVENTS.NEW_MESSAGE, ({ chatId, message }) => {
        if (chatId === currentChatId) {
            addMessageToCache(chatId, message);
        }

        updateChatInCache(chatId, {
            lastMessage: {
                _id: message._id,
                content: message.content,
                sender: message.sender,
                createdAt: message.createdAt
            },
            lastMessageAt: message.createdAt
        });
    });

    useSocketEvent<ChatMessageEvent>(SOCKET_CHAT_EVENTS.MESSAGE_EDITED, ({ chatId, message }) => {
        if (chatId === currentChatId) {
            updateMessageInCache(chatId, message._id, message);
        }
    });

    useSocketEvent<{ chatId: string; messageId: string }>(SOCKET_CHAT_EVENTS.MESSAGE_DELETED, ({ chatId, messageId }) => {
        if (chatId === currentChatId) {
            updateMessageInCache(chatId, messageId, { deleted: true });
        }
    });

    useSocketEvent<ChatMessageEvent>(SOCKET_CHAT_EVENTS.REACTION_UPDATED, ({ chatId, message }) => {
        if (chatId === currentChatId) {
            updateMessageInCache(chatId, message._id, { reactions: message.reactions });
        }
    });

    useSocketEvent<TypingUser>(SOCKET_CHAT_EVENTS.USER_TYPING, (typing) => {
        if (typing.chatId === currentChatId) {
            setTypingUser(typing);
        }
    });

    useSocketEvent<Record<string, PresenceStatus.Online | PresenceStatus.Offline>>(
        SOCKET_CHAT_EVENTS.USERS_PRESENCE_INFO,
        setUsersPresence
    );

    useChatListRefreshOn(SOCKET_CHAT_EVENTS.GROUP_CREATED);
    useChatListRefreshOn(SOCKET_CHAT_EVENTS.USERS_ADDED_TO_GROUP);
    useChatListRefreshOn(SOCKET_CHAT_EVENTS.USERS_REMOVED_FROM_GROUP);
    useChatListRefreshOn(SOCKET_CHAT_EVENTS.GROUP_INFO_UPDATED);
    useChatListRefreshOn(SOCKET_CHAT_EVENTS.USER_LEFT_GROUP);
};

export default useChatSocket;
