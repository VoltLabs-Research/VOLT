import { getChatDisplayName } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import { cn } from '@/shared/utils';
import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@/modules/chat/api/entities/chat';
import './ChatListItem.css';

interface ChatListItemProps {
    chat: Chat;
    currentUserId?: string;
    isActive?: boolean;
    onClick: () => void;
};

const ChatListItem = ({ chat, currentUserId, isActive, onClick }: ChatListItemProps) => {
    const displayName = getChatDisplayName(chat, currentUserId);

    return (
        <button
            type='button'
            className={cn('d-flex items-center gap-075 list-item-hoverable chat-list-item', isActive && 'active')}
            aria-current={isActive ? 'page' : undefined}
            onClick={onClick}
        >
            <ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' className='f-shrink-0' />

            <div className='volt-container d-flex column gap-025 flex-1 overflow-hidden'>
                <div className='volt-container d-flex items-center content-between gap-05'>
                    <p className='volt-text font-size-3 font-weight-6 color-primary chat-list-item-name text-truncate'>
                        {displayName}
                    </p>
                    {chat.lastMessageAt && (
                        <p className='volt-text font-size-2 color-muted chat-list-item-time'>
                            {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })}
                        </p>
                    )}
                </div>

                {chat.lastMessage && (
                    <p className='volt-text font-size-2 color-secondary chat-list-item-preview text-truncate'>
                        {chat.lastMessage.content}
                    </p>
                )}

                {chat.isGroup && (
                    <p className='volt-text font-size-2 color-muted'>
                        {chat.participants.length} members
                    </p>
                )}
            </div>
        </button>
    );
};

export default ChatListItem;
