import { PresenceStatus } from '../../api/entities/shared/chat-events';
import type { Chat } from '../../api/entities/chat';
import type { User } from '@/modules/auth/api/entities/user';

export const getOtherParticipant = (chat: Chat, currentUserId?: string): User | undefined => {
    return chat.participants.find((p) => p._id !== currentUserId);
};

export const getChatDisplayName = (chat: Chat, currentUserId?: string): string => {
    if (chat.isGroup) return chat.groupName || 'Unnamed Group';
    const other = getOtherParticipant(chat, currentUserId);
    let displayName = 'Unknown';

    if (other) {
        displayName = `${other.firstName} ${other.lastName}`;
    }

    return displayName;
};

export const getChatStatusText = (chat: Chat, presence: PresenceStatus): string => {
    if (chat.isGroup) return `${chat.participants.length} members`;
    if (presence === PresenceStatus.Online) return 'Online';
    if (presence === PresenceStatus.Offline) return 'Offline';
    return '';
};

export const getMemberRole = (
    chat: Chat,
    memberId: string
): 'owner' | 'admin' | 'member' => {
    if (chat.createdBy?._id === memberId) return 'owner';
    if (chat.admins?.some((a) => a._id === memberId)) return 'admin';
    return 'member';
};
