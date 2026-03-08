import type { Chat } from '../api/entities/chat';
import type { PresenceStatus } from '../api/entities/chat-events';
import type { User } from '@/modules/auth/api/entities/user';

export const getOtherParticipant = (chat: Chat, currentUserId?: string): User | undefined => {
    return chat.participants.find((p) => p._id !== currentUserId);
};

export const getChatDisplayName = (chat: Chat, currentUserId?: string): string => {
    if (chat.isGroup) return chat.groupName || 'Unnamed Group';
    const other = getOtherParticipant(chat, currentUserId);
    return other ? `${other.firstName} ${other.lastName}` : 'Unknown';
};

export const getChatStatusText = (chat: Chat, presence: PresenceStatus): string => {
    if (chat.isGroup) return `${chat.participants.length} members`;
    if (presence === 'online') return 'Online';
    if (presence === 'offline') return 'Offline';
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
