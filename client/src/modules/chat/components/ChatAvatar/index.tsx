import { getOtherParticipant } from '@/modules/chat/utils/chat/chat-display';
import { Users } from 'lucide-react';
import { cn } from '@heroui/react';
import UserAvatar from '../UserAvatar';
import type { UserAvatarSize } from '../UserAvatar';
import type { Chat } from '@volt/contracts/modules/chat/domain';

interface ChatAvatarProps {
    chat: Chat;
    currentUserId?: string;
    size?: UserAvatarSize;
    showStatus?: boolean;
    isOnline?: boolean;
    className?: string;
};

const GROUP_ICON_SIZES: Record<UserAvatarSize, number> = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 32
};

/*
 * A group chat has no participant to take an avatar from, so it gets the raised
 * surface plus a hairline instead — which is what `.chat-avatar-group` was
 * reaching for. Its `background: var(--color-surface-elevated)` never resolved:
 * that token is declared nowhere in bravais or in the app, so the whole
 * declaration was invalid and the tile rendered transparent.
 */
const GROUP_CLASS_NAMES = 'bg-surface-secondary border border-border';

const ChatAvatar = ({
    chat,
    currentUserId,
    size = 'sm',
    showStatus,
    isOnline,
    className
}: ChatAvatarProps) => {
    return (
        <UserAvatar
            user={chat.isGroup ? undefined : getOtherParticipant(chat, currentUserId)}
            icon={chat.isGroup ? <Users size={GROUP_ICON_SIZES[size]} /> : undefined}
            size={size}
            showStatus={showStatus}
            isOnline={isOnline}
            className={cn(chat.isGroup && GROUP_CLASS_NAMES, className)}
        />
    );
};

export default ChatAvatar;
