import type { ReactNode } from 'react';
import EmptyState from '@/shared/presentation/components/EmptyState';
import MessageListSkeleton from '../../atoms/MessageListSkeleton';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
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

    if (hasMore) {
        loadMoreIndicator = (
            <Container className='d-flex flex-center p-1'>
                <Paragraph className='font-size-1 color-muted'>Loading more...</Paragraph>
            </Container>
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
            renderLoading={<MessageListSkeleton />}
            renderEmpty={<EmptyState title='No messages yet' description='Start the conversation!' />}
            loadMoreIndicator={loadMoreIndicator}
        />
    );
};

export default MessageList;
