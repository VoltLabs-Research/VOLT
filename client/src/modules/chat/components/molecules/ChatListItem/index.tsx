import { getChatDisplayName } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../../atoms/ChatAvatar';
import { cn } from '@/shared/utils';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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

            <Container className='d-flex column gap-025 flex-1 overflow-hidden'>
                <Container className='d-flex items-center content-between gap-05'>
                    <Paragraph className='font-size-3 font-weight-6 color-primary chat-list-item-name text-truncate'>
                        {displayName}
                    </Paragraph>
                    {chat.lastMessageAt && (
                        <Paragraph className='font-size-2 color-muted chat-list-item-time'>
                            {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })}
                        </Paragraph>
                    )}
                </Container>

                {chat.lastMessage && (
                    <Paragraph className='font-size-2 color-secondary chat-list-item-preview text-truncate'>
                        {chat.lastMessage.content}
                    </Paragraph>
                )}

                {chat.isGroup && (
                    <Paragraph className='font-size-2 color-muted'>
                        {chat.participants.length} members
                    </Paragraph>
                )}
            </Container>
        </button>
    );
};

export default ChatListItem;
