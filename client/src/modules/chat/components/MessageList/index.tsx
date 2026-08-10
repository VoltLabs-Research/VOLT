import { Skeleton } from '@heroui/react';
import type { ReactNode } from 'react';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import AutoScrollList from '@/shared/ui/components/AutoScrollList';
import type { ChatMessage } from '@volt/contracts/modules/chat/domain';

interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    renderMessage: (message: ChatMessage) => ReactNode;
}

/*
 * A loading placeholder is shaped like the thing it replaces, so the skeletons
 * alternate sides the way a thread does — which is all `.message-skeleton.sent` /
 * `.received` ever did.
 */
const SKELETON_CLASS_NAMES = 'flex flex-col gap-1 max-w-[70%]';

const SKELETON_SIDE_CLASS_NAMES = {
    sent: 'ml-auto',
    received: 'mr-auto'
} as const;

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
            className='px-6 py-4'
            preserveScrollOnPrepend
            renderLoading={(
                <div className='flex flex-col gap-4'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div className={`${SKELETON_CLASS_NAMES} ${SKELETON_SIDE_CLASS_NAMES[i % 3 === 0 ? 'sent' : 'received']}`} key={i} aria-hidden='true'>
                            <Skeleton className='h-4 w-4/5 rounded-xl' />
                            <Skeleton className='h-4 w-3/5 rounded-xl' />
                        </div>
                    ))}
                </div>
            )}
            renderEmpty={<RecoveryState title='No messages yet' description='Start the conversation!' />}
            loadMoreIndicator={loadMoreIndicator}
        />
    );
};

export default MessageList;
