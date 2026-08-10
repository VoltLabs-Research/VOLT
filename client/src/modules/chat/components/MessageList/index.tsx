import { cn } from '@heroui/react';
import type { ReactNode } from 'react';
import { EmptyState, Skeleton } from '@voltstack/bravais';
import AutoScrollList from '@/shared/ui/components/AutoScrollList';
import '../MessageListSkeleton/MessageListSkeleton.css';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';
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
            <div className='flex p-4 items-center justify-center'>
                <p className='text-sm text-muted'>Loading more...</p>
            </div>
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
                <div className='flex flex-col gap-4'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div className={cn('flex flex-col gap-1', `message-skeleton ${i % 3 === 0 ? 'sent' : 'received'}`)} key={i}>
                            <Skeleton variant='rounded' width='80%' height='1rem' />
                            <Skeleton variant='rounded' width='60%' height='1rem' />
                        </div>
                    ))}
                </div>
            )}
            renderEmpty={<EmptyState title='No messages yet' description='Start the conversation!' />}
            loadMoreIndicator={loadMoreIndicator}
        />
    );
};

export default MessageList;
