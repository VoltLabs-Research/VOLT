import { getChatDisplayName } from '@/modules/chat/utilities/chat/chat-display';
import ChatAvatar from '../ChatAvatar';
import ListRow from '@/shared/presentation/primitives/ListRow';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
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

    const content = (
        <Stack gap='025' flex='1' overflow='hidden'>
            <Row justify='between' gap='05'>
                <Text as='p' size='lg' weight='bold' truncate className='chat-list-item-name'>
                    {displayName}
                </Text>
                {chat.lastMessageAt && (
                    <Text as='p' size='md' tone='muted' className='chat-list-item-time'>
                        {formatDistanceToNow(new Date(chat.lastMessageAt), { addSuffix: false })}
                    </Text>
                )}
            </Row>

            {chat.lastMessage && (
                <Text as='p' size='md' tone='secondary' truncate className='chat-list-item-preview'>
                    {chat.lastMessage.content}
                </Text>
            )}

            {chat.isGroup && (
                <Text as='p' size='md' tone='muted'>
                    {chat.participants.length} members
                </Text>
            )}
        </Stack>
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
