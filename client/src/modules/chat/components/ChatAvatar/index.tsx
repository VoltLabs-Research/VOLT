import type { ReactNode } from 'react';
import { getOtherParticipant } from '@/modules/chat/utilities/chat/chat-display';
import { IoPeopleOutline } from 'react-icons/io5';
import { cn } from '@/shared/utils/cn';
import { Avatar } from '@voltstack/bravais';
import type { Chat } from '@/modules/chat/api/entities/chat';
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
    const otherParticipant = getOtherParticipant(chat, currentUserId);
    const iconSize = GROUP_ICON_SIZES[size];
    let icon: ReactNode;

    if (chat.isGroup) {
        icon = <IoPeopleOutline size={iconSize} />;
    }
    
    return (
        <Avatar
            user={chat.isGroup ? undefined : otherParticipant}
            icon={icon}
            size={size}
            showStatus={showStatus}
            isOnline={isOnline}
            className={cn(chat.isGroup && 'chat-avatar-group', className)}
        />
    );
};

export default ChatAvatar;
