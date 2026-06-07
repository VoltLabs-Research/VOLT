import type { ReactNode } from 'react';
import { EmptyState, Skeleton, Stack, Box, Text } from '@voltstack/bravais';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import '../MessageListSkeleton/MessageListSkeleton.css';
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
            renderLoading={(
                <Stack gap='1'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Stack key={i} gap='025' className={`message-skeleton ${i % 3 === 0 ? 'sent' : 'received'}`}>
                            <Skeleton variant='rounded' width='80%' height='1rem' />
                            <Skeleton variant='rounded' width='60%' height='1rem' />
                        </Stack>
                    ))}
                </Stack>
            )}
            renderEmpty={<EmptyState title='No messages yet' description='Start the conversation!' />}
            loadMoreIndicator={loadMoreIndicator}
        />
    );
};

export default MessageList;
