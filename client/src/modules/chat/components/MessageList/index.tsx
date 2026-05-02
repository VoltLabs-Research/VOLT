import type { ReactNode } from 'react';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import MessageListSkeleton from '../MessageListSkeleton';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import Box from '@/shared/presentation/primitives/Box';
import Text from '@/shared/presentation/primitives/Text';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import './MessageList.css';

interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    renderMessage: (message: ChatMessage) => ReactNode;
}

const MessageList = ({ messages, isLoading, hasMore, onLoadMore, renderMessage }: MessageListProps) => {
    let loadMoreIndicator: ReactNode = null;

    if (hasMore && isLoading) {
        loadMoreIndicator = (
            <Box display='flex' p='1' className='flex-center'>
                <Text as='p' size='md' tone='muted'>Loading more...</Text>
            </Box>
        );
    }

    return (
        <AutoScrollList
            items={messages}
            isLoading={isLoading}
            getItemKey={(message) => message._id}
            renderItem={renderMessage}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            className='message-list'
            preserveScrollOnPrepend
            renderLoading={<MessageListSkeleton />}
            renderEmpty={<EmptyState title='No messages yet' description='Start the conversation!' />}
            loadMoreIndicator={loadMoreIndicator}
        />
    );
};

export default MessageList;
