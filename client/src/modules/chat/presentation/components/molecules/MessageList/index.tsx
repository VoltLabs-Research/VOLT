import { useRef, useEffect } from 'react';
import type { ChatMessage } from '@/modules/chat/domain/entities';
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
    const bottomRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const prevMessagesLengthRef = useRef(messages.length);

    useEffect(() => {
        if (messages.length > prevMessagesLengthRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevMessagesLengthRef.current = messages.length;
    }, [messages.length]);

    useEffect(() => {
        if (messages.length > 0 && !isLoading) {
            bottomRef.current?.scrollIntoView();
        }
    }, [isLoading]);

    const handleScroll = () => {
        if (!containerRef.current || !hasMore || isLoading || !onLoadMore) return;
        if (containerRef.current.scrollTop < 100) onLoadMore();
    };

    if (isLoading && messages.length === 0) {
        return (
            <Container className='d-flex column gap-05 flex-1 y-auto message-list'>
                <MessageListSkeleton />
            </Container>
        );
    }

    if (messages.length === 0) {
        return (
            <Container className='d-flex flex-center flex-1 message-list'>
                <EmptyState title='No messages yet' description='Start the conversation!' />
            </Container>
        );
    }

    return (
        <Container ref={containerRef} className='d-flex column gap-05 flex-1 y-auto message-list' onScroll={handleScroll}>
            {hasMore && (
                <Container className='d-flex flex-center p-1'>
                    <Paragraph className='font-size-1 color-muted'>Loading more...</Paragraph>
                </Container>
            )}
            {messages.map(renderMessage)}
            <Container ref={bottomRef} />
        </Container>
    );
};

export default MessageList;
