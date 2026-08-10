import { getChatDisplayName } from '@/modules/chat/utils/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import { ListRow } from '@voltstack/bravais';
import { cn } from '@/shared/utils/cn';
import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@volt/contracts/modules/chat/domain';
import './ChatListItem.css';

interface ChatListItemProps {
    chat: Chat;
    currentUserId?: string;
    isActive?: boolean;
    onClick: () => void;
}

const ChatListItem = ({ chat, currentUserId, isActive, onClick }: ChatListItemProps) => {
    const displayName = getChatDisplayName(chat, currentUserId);

    const content = (
        <div className='flex flex-col gap-1 overflow-hidden flex-1'>
            <div className='flex flex-row items-center justify-between gap-2'>
                <p className='text-base font-semibold truncate chat-list-item-name'>
                    {displayName}
                </p>
                {chat.lastMessageAt && (
                    <p className='text-sm text-muted chat-list-item-time'>
                        {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })}
                    </p>
                )}
            </div>

            {chat.lastMessage && (
                <p className='text-sm text-muted truncate chat-list-item-preview'>
                    {chat.lastMessage.content}
                </p>
            )}

            {chat.isGroup && (
                <p className='text-sm text-muted'>
                    {chat.participants.length} members
                </p>
            )}
        </div>
    );

    return (
        <ListRow
            leading={<ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' />}
            meta={content}
            selected={isActive}
            onClick={onClick}
            aria-current={isActive ? 'page' : undefined}
            className={cn('chat-list-item', isActive && 'active')}
        />
    );
};

export default ChatListItem;
