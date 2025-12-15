import React from 'react';
import type { Message } from '@/types/chat';
import MessageSkeleton from '@/components/atoms/chat/messages/MessagesSkeleton';
import Paragraph from '@/components/primitives/Paragraph';
import './MessageLists.css';

export type MessageListProps = {
    messages: Message[];
    isLoading: boolean;
    endRef: React.RefObject<HTMLDivElement>;
    renderItem: (m: Message, isOwn: boolean) => React.ReactNode;
    selfId?: string;
};

const MessageList = ({ messages, isLoading, endRef, renderItem, selfId }: MessageListProps) => {
    return (
        <div className='d-flex column gap-05 chat-box-messages-container'>
            {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                    <MessageSkeleton key={`message-skeleton-${index}`} isSent={index % 3 === 0} />
                ))
            ) : messages.length === 0 ? (
                <div className='d-flex column flex-center chat-empty-messages'>
                    <Paragraph>No messages yet</Paragraph>
                    <Paragraph>Start the conversation!</Paragraph>
                </div>
            ) : (
                messages.map((m) => renderItem(m, m.sender._id === selfId))
            )}
            <div ref={endRef} />
        </div>
    );
}

export default MessageList;
