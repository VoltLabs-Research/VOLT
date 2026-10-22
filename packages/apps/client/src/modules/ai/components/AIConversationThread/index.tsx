import AIMessageItem from '@/modules/ai/components/AIConversationThread/AIMessageItem';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import AutoScrollList from '@/shared/ui/components/AutoScrollList';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { Button, Skeleton } from '@heroui/react';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';
import type { ChatUIMessage } from '@volt/contracts/modules/ai/chat';

interface AIConversationThreadProps {
    messages: ChatUIMessage[];
    isLoading: boolean;
    isStreaming: boolean;
    canDecide: boolean;
    loadError?: string | null;
    hasEarlier: boolean;
    isLoadingEarlier: boolean;
    onLoadEarlier: () => void;
    onRetry?: () => void;
    onDecide: (approvalIds: string[], approved: boolean) => void;
    onOpenTableArtifact?: (artifact: AITableArtifact) => void;
}

export const PromptStarter = () => (
    <div className='flex flex-1 flex-col items-center justify-center gap-3 px-4 py-8'>
        <p className='text-center text-2xl font-semibold tracking-tight text-foreground'>
            Ready when you are.
        </p>
        <p className='max-w-md text-center text-base text-muted'>
            Ask about a trajectory, run an analysis pipeline, or have Volt AI drive the viewer for you.
        </p>
    </div>
);

const sizeOf = (message: ChatUIMessage | undefined): number => message === undefined ? 0 : message.parts.reduce((total, part) => {
    if (part.type === 'text' || part.type === 'reasoning') return total + part.text.length;
    return total + 1;
}, 0);

const AIConversationThread = ({
    messages,
    isLoading,
    isStreaming,
    canDecide,
    loadError,
    hasEarlier,
    isLoadingEarlier,
    onLoadEarlier,
    onRetry,
    onDecide,
    onOpenTableArtifact
}: AIConversationThreadProps) => {
    const lastMessage = messages[messages.length - 1];
    const isAwaitingReply = isStreaming && (lastMessage === undefined || lastMessage.role === 'user');

    if (loadError && messages.length === 0) {
        return (
            <div className='flex flex-1 items-center justify-center'>
                <RecoveryState
                    title='Failed to load conversation'
                    description={loadError}
                    tone={RecoveryStateTone.Error}
                    retryLabel={onRetry ? 'Retry' : undefined}
                    onRetry={onRetry}
                />
            </div>
        );
    }

    if (!isLoading && messages.length === 0 && !isAwaitingReply) {
        return <PromptStarter />;
    }

    const loadEarlierIndicator = (
        <div className='flex justify-center'>
            <Button
                size='sm'
                variant='ghost'
                className='text-muted'
                isDisabled={isLoadingEarlier}
                onPress={onLoadEarlier}
            >
                {isLoadingEarlier ? 'Loading earlier messages…' : 'Load earlier messages'}
            </Button>
        </div>
    );

    return (
        <section className='flex min-h-0 flex-1 flex-col' aria-label='Conversation messages'>
            <AutoScrollList
                items={messages}
                isLoading={isLoading}
                className='mx-auto w-full max-w-3xl gap-6 px-3 pt-6 pb-3 [.ai-floating-assistant_&]:gap-4 [.ai-floating-assistant_&]:px-4 [.ai-floating-assistant_&]:py-3'
                getItemKey={(message) => message.id}
                hasMore={hasEarlier}
                onLoadMore={onLoadEarlier}
                loadMoreIndicator={loadEarlierIndicator}
                preserveScrollOnPrepend
                autoScrollDependency={isAwaitingReply ? 'awaiting' : `${lastMessage?.id ?? ''}:${sizeOf(lastMessage)}`}
                autoScrollDependencyEnabled={isStreaming}
                renderLoading={Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className='h-14 w-full rounded-2xl' />
                ))}
                renderAfter={isAwaitingReply ? <ThinkingBubble /> : null}
                renderItem={(message, index) => (
                    <AIMessageItem
                        message={message}
                        messageIndex={index}
                        totalMessages={messages.length}
                        isStreaming={isStreaming && index === messages.length - 1}
                        canDecide={canDecide}
                        onDecide={onDecide}
                        onOpenTableArtifact={onOpenTableArtifact}
                    />
                )}
            />

            <span className='sr-only'
                role='log'
                aria-live='polite'
                aria-relevant='additions text'
                aria-atomic='false'
            >
                {isStreaming ? 'Assistant is responding.' : `Loaded ${messages.length} messages.`}
            </span>
        </section>
    );
};

export default AIConversationThread;
