import { formatDistanceToNow } from 'date-fns';
import type { Chat } from '@/modules/chat/domain/entities';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { cn } from '@/shared/utils/cn';
import { ChatAvatar } from '../../atoms';
import { getChatDisplayName } from '@/modules/chat/presentation/utilities';
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
        <Container
            className={cn('d-flex items-center gap-075 list-item-hoverable chat-list-item', isActive && 'active')}
            onClick={onClick}
        >
            <ChatAvatar chat={chat} currentUserId={currentUserId} size='sm' className='f-shrink-0' />
            
            <Container className='d-flex column gap-025 flex-1 overflow-hidden'>
                <Container className='d-flex items-center content-between gap-05'>
                    <Paragraph className='font-size-2-5 font-weight-6 color-primary chat-list-item-name'>
                        {displayName}
                    </Paragraph>
                    {chat.lastMessageAt && (
                        <Paragraph className='color-muted chat-list-item-time'>
                            {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })}
                        </Paragraph>
                    )}
                </Container>
                
                {chat.lastMessage && (
                    <Paragraph className='font-size-1 color-secondary chat-list-item-preview'>
                        {chat.lastMessage.content}
                    </Paragraph>
                )}
                
                {chat.isGroup && (
                    <Paragraph className='font-size-1 color-muted'>
                        {chat.participants.length} members
                    </Paragraph>
                )}
            </Container>
        </Container>
    );
};

export default ChatListItem;
