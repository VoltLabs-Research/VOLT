import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import AIMessageItem from '@/modules/ai/components/AIConversationThread/AIMessageItem';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import useNormalizedMessages from '@/modules/ai/components/AIConversationThread/use-normalized-messages';
import AutoScrollList from '@/shared/ui/components/AutoScrollList';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { Skeleton } from '@voltstack/bravais';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { NormalizedConversationMessage } from '@/modules/ai/utils/message-segments';
import type { UIMessage } from 'ai';
import type { ToolApprovalResponseParams } from '@/modules/ai/contracts/tools';
import type { ReactNode } from 'react';
import './AIConversationThread.css';

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
    <div className='flex flex-col items-center justify-center gap-4 flex-1 ai-thread-starter'>
        <p className='text-3xl font-medium text-foreground ai-thread-starter-title'>
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
            <div className='flex flex-col gap-1 ai-message-row is-assistant'>
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
            className='ai-thread-list'
            getItemKey={(message) => message.id}
            autoScrollDependency={autoScrollDependency}
            autoScrollDependencyEnabled={isResponding || showStandaloneTyping}
            renderLoading={Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} variant='text' width='100%' height='3.5rem' />
            ))}
            renderAfter={renderAfter}
            renderItem={renderMessageItem}
        />
    );

    if (!isLoading && normalizedMessages.length === 0 && !showStandaloneTyping) {
        threadContent = renderPromptStarter();
    }

    return (
        <section className='flex flex-col flex-1 ai-thread-region' aria-label='Conversation messages'>
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
