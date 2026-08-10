import { getOtherParticipant } from '@/modules/chat/utils/chat/chat-display';
import { Users } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { Avatar } from '@voltstack/bravais';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import './ChatAvatar.css';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

interface ChatAvatarProps {
    chat: Chat;
    currentUserId?: string;
    size?: AvatarSize;
    showStatus?: boolean;
    isOnline?: boolean;
    className?: string;
}

const GROUP_ICON_SIZES: Record<AvatarSize, number> = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 32
};

const ChatAvatar = ({ 
    chat, 
    currentUserId, 
    size = 'sm', 
    showStatus, 
    isOnline, 
    className 
}: ChatAvatarProps) => {
    return (
        <Avatar
            user={chat.isGroup ? undefined : getOtherParticipant(chat, currentUserId)}
            icon={chat.isGroup ? <Users size={GROUP_ICON_SIZES[size]} /> : undefined}
            size={size}
            showStatus={showStatus}
            isOnline={isOnline}
            className={cn(chat.isGroup && 'chat-avatar-group', className)}
        />
    );
};

export default ChatAvatar;
