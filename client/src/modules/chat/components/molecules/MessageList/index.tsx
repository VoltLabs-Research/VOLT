import type { ChatMessage } from '@/modules/chat/api/entities/chat-message';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import EmptyState from '@/shared/presentation/components/EmptyState';
import { MessageListSkeleton } from '../../atoms';
import './MessageList.css';

interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    renderMessage: (message: ChatMessage) => React.ReactNode;
};

const MessageList = ({ messages, isLoading, hasMore, onLoadMore, renderMessage }: MessageListProps) => {
    return (
        <AutoScrollList
            items={messages}
            isLoading={isLoading}
            getItemKey={(message) => message._id}
            renderItem={(message) => renderMessage(message)}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            className='message-list'
            renderLoading={<MessageListSkeleton />}
            renderEmpty={<EmptyState title='No messages yet' description='Start the conversation!' />}
            loadMoreIndicator={hasMore ? (
                <Container className='d-flex flex-center p-1'>
                    <Paragraph className='font-size-1 color-muted'>Loading more...</Paragraph>
                </Container>
            ) : null}
        />
    );
};

export default MessageList;
