import React from 'react';
import type { Message } from '@/modules/chat/domain/entities/Chat';
import MessageSkeleton from '@/modules/chat/presentation/components/atoms/messages/MessagesSkeleton';
import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import '@/modules/chat/presentation/components/molecules/MessageLists/MessageLists.css';

export type MessageListProps = {
    messages: Message[];
    isLoading: boolean;
    endRef: React.RefObject<HTMLDivElement>;
    renderItem: (m: Message, isOwn: boolean) => React.ReactNode;
    selfId?: string;
};

const MessageList = ({ messages, isLoading, endRef, renderItem, selfId }: MessageListProps) => {
    return (
        <div className='d-flex column gap-05 chat-box-messages-container p-relative y-auto flex-1 p-1-5'>
            {isLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                    <MessageSkeleton key={`message-skeleton-${index}`} isSent={index % 3 === 0} />
                ))
            ) : messages.length === 0 ? (
                <div className='d-flex column flex-center chat-empty-messages h-max text-center color-secondary p-2'>
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
