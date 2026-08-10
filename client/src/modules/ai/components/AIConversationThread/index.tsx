import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import AIMessageItem from '@/modules/ai/components/AIConversationThread/AIMessageItem';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import useNormalizedMessages from '@/modules/ai/components/AIConversationThread/use-normalized-messages';
import {
    MESSAGE_ROW,
    MESSAGE_ROW_ASSISTANT,
    THREAD_LIST,
    THREAD_REGION,
    THREAD_STARTER,
    THREAD_STARTER_TITLE
} from '@/modules/ai/components/AIConversationThread/thread-styles';
import AutoScrollList from '@/shared/ui/components/AutoScrollList';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { Skeleton, cn } from '@heroui/react';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { NormalizedConversationMessage } from '@/modules/ai/utils/message-segments';
import type { UIMessage } from 'ai';
import type { ToolApprovalResponseParams } from '@/modules/ai/contracts/tools';
import type { ReactNode } from 'react';

interface AIConversationThreadProps {
    conversationId?: string;
    isLoading?: boolean;
    isResponding?: boolean;
    error?: string | null;
    messages: UIMessage[];
    onOpenTableArtifact?: (artifact: AIMessageArtifact) => void;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
    onRetry?: () => void;
}

const renderPromptStarter = () => (
    <div className={THREAD_STARTER}>
        <p className={THREAD_STARTER_TITLE}>
            Ready when you are.
        </p>
    </div>
);

const AIConversationThread = ({
    conversationId,
    isLoading = false,
    isResponding = false,
    error,
    messages,
    onOpenTableArtifact,
    addToolApprovalResponse,
    onRetry
}: AIConversationThreadProps) => {
    const normalizedMessages = useNormalizedMessages(messages);
    const lastMessage = normalizedMessages[normalizedMessages.length - 1];
    const showStandaloneTyping = isResponding && (!lastMessage || lastMessage.role === AIMessageRole.User);

    const renderMessageItem = (message: NormalizedConversationMessage, index: number) => (
        <AIMessageItem
            message={message}
            messageIndex={index}
            totalMessages={normalizedMessages.length}
            onOpenTableArtifact={onOpenTableArtifact}
            addToolApprovalResponse={addToolApprovalResponse}
        />
    );

    if (!conversationId) {
        return renderPromptStarter();
    }

    if (error) {
        return (
            <div className='flex flex-1 items-center justify-center ai-thread-empty'>
                <RecoveryState
                    title='Failed to load conversation'
                    description={error}
                    retryLabel={onRetry ? 'Retry' : undefined}
                    onRetry={onRetry}
                />
            </div>
        );
    }

    let renderAfter: ReactNode = null;
    let autoScrollDependency = '';
    if (showStandaloneTyping) {
        renderAfter = (
            <div className={cn(MESSAGE_ROW, MESSAGE_ROW_ASSISTANT, 'gap-1')}>
                <ThinkingBubble />
            </div>
        );
        autoScrollDependency = 'typing';
    } else if (lastMessage) {
        autoScrollDependency = `${lastMessage.id}:${lastMessage.preview.length}:${lastMessage.reasoning.length}`;
    }

    let threadContent: ReactNode = (
        <AutoScrollList
            items={normalizedMessages}
            isLoading={isLoading}
            className={THREAD_LIST}
            getItemKey={(message) => message.id}
            autoScrollDependency={autoScrollDependency}
            autoScrollDependencyEnabled={isResponding || showStandaloneTyping}
            renderLoading={Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className='h-14 w-full rounded-md' />
            ))}
            renderAfter={renderAfter}
            renderItem={renderMessageItem}
        />
    );

    if (!isLoading && normalizedMessages.length === 0 && !showStandaloneTyping) {
        threadContent = renderPromptStarter();
    }

    return (
        <section className={THREAD_REGION} aria-label='Conversation messages'>
            {threadContent}

            <span className='sr-only'
                role='log'
                aria-live='polite'
                aria-relevant='additions text'
                aria-atomic='false'
            >
                {isResponding ? 'Assistant is responding.' : `Loaded ${normalizedMessages.length} messages.`}
            </span>
        </section>
    );
};

export default AIConversationThread;
