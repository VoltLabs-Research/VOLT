import { useMemo } from 'react';
import type { Chat } from '../api/entities/chat';
import type { PresenceStatus } from '../api/entities/chat-events';
import type { User } from '@/modules/auth/api/entities/user';
import { getOtherParticipant, getChatDisplayName, getChatStatusText } from '../utilities';

interface ChatDisplayData {
    otherParticipant: User | undefined;
    displayName: string;
    statusText: string;
}

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
        
        return {
            otherParticipant: getOtherParticipant(chat, currentUserId),
            displayName: getChatDisplayName(chat, currentUserId),
            statusText: getChatStatusText(chat, presence || 'unknown')
        };
    }, [chat, currentUserId, presence]);
};

export default useChatDisplay;
