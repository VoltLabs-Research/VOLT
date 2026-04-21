import type { ReactNode } from 'react';
import EmptyState from '@/shared/presentation/components/EmptyState';
import MessageListSkeleton from '../MessageListSkeleton';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import type { ChatMessage } from '@/modules/chat/api/entities/message';
import './MessageList.css';

interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    renderMessage: (message: ChatMessage) => ReactNode;
};

const MessageList = ({ messages, isLoading, hasMore, onLoadMore, renderMessage }: MessageListProps) => {
    let loadMoreIndicator: ReactNode = null;

    if (hasMore && isLoading) {
        loadMoreIndicator = (
            <div className='volt-container d-flex flex-center p-1'>
                <p className='volt-text font-size-2 color-muted'>Loading more...</p>
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
            renderLoading={<MessageListSkeleton />}
            renderEmpty={<EmptyState title='No messages yet' description='Start the conversation!' />}
            loadMoreIndicator={loadMoreIndicator}
        />
    );
};

export default MessageList;
