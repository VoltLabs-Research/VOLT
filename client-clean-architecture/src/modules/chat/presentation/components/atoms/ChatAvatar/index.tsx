import { IoPeopleOutline } from 'react-icons/io5';
import type { Chat } from '@/modules/chat/domain/entities';
import Avatar from '@/shared/presentation/components/Avatar';
import { cn } from '@/shared/utils/cn';
import { getOtherParticipant } from '@/modules/chat/presentation/utilities';
import './ChatAvatar.css';

const GROUP_ICON_SIZES = {
    xs: 14,
    sm: 18,
    md: 24,
    lg: 32
} as const;

type AvatarSize = keyof typeof GROUP_ICON_SIZES;

interface ChatAvatarProps {
    chat: Chat;
    currentUserId?: string;
    size?: AvatarSize;
    showStatus?: boolean;
    isOnline?: boolean;
    className?: string;
}

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
    
    return (
        <Avatar
            user={chat.isGroup ? undefined : otherParticipant}
            icon={chat.isGroup ? <IoPeopleOutline size={iconSize} /> : undefined}
            size={size}
            showStatus={showStatus}
            isOnline={isOnline}
            className={cn(chat.isGroup && 'chat-avatar-group', className)}
        />
    );
};

export default ChatAvatar;
