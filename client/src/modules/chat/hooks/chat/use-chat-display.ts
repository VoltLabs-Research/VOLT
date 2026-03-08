import { PresenceStatus } from '../../api/entities/shared/chat-events';
import { getOtherParticipant, getChatDisplayName, getChatStatusText } from '../../utilities/chat/chat-display';
import { useMemo } from 'react';
import type { Chat } from '../../api/entities/chat';
import type { User } from '@/modules/auth/api/entities/user';

interface ChatDisplayData {
    otherParticipant: User | undefined;
    displayName: string;
    statusText: string;
};

/**
 * Hook that memoizes chat display data (other participant, display name, status text).
 * Centralizes the logic for getting display information from a chat.
 * 
 * @param chat - The chat to get display data for
 * @param currentUserId - The current user's ID
 * @param presence - The presence status of the other participant
 * @returns Memoized display data or null if chat is null
 */
const useChatDisplay = (
    chat: Chat | null, 
    currentUserId?: string, 
    presence?: PresenceStatus
): ChatDisplayData | null => {
    return useMemo(() => {
        if (!chat) return null;

        let nextPresence = PresenceStatus.Unknown;

        if (presence) {
            nextPresence = presence;
        }
        
        return {
            otherParticipant: getOtherParticipant(chat, currentUserId),
            displayName: getChatDisplayName(chat, currentUserId),
            statusText: getChatStatusText(chat, nextPresence)
        };
    }, [chat, currentUserId, presence]);
};

export default useChatDisplay;
