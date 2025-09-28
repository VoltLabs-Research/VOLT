import React from 'react';
import type { Message } from '@/types/chat';
import MessageSkeleton from '@/components/atoms/messages/MessagesSkeleton';

export type MessageListProps = {
    messages: Message[];
    isLoading: boolean;
    endRef: React.RefObject<HTMLDivElement>;
    renderItem: (m: Message, isOwn: boolean) => React.ReactNode;
    selfId?: string;
};

const MessageList = ({ messages, isLoading, endRef, renderItem, selfId }: MessageListProps) => {
    return (
        <div className='chat-box-messages-container'>
            {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                    <MessageSkeleton key={`message-skeleton-${index}`} variant='message' isSent={index % 3 === 0} />
                ))
            ) : messages.length === 0 ? (
                <div className='chat-empty-messages'>
                    <p>No messages yet</p>
                    <p>Start the conversation!</p>
                </div>
            ) : (
                messages.map((m) => renderItem(m, m.sender._id === selfId))
            )}
            <div ref={endRef} />
        </div>
    );
}

export default MessageList;