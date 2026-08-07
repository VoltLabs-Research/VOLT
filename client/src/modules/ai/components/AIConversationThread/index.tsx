import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import AIMessageItem from '@/modules/ai/components/AIConversationThread/AIMessageItem';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import useNormalizedMessages from '@/modules/ai/components/AIConversationThread/use-normalized-messages';
import AutoScrollList from '@/shared/ui/components/AutoScrollList';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { Box, Skeleton, Stack, Text, VisuallyHidden } from '@voltstack/bravais';
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
    <Stack flex='1' align='center' justify='center' gap='1' className='ai-thread-starter'>
        <Text as='p' size='3xl' weight='medium' tone='primary' className='ai-thread-starter-title'>
            Ready when you are.
        </Text>
    </Stack>
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
            <Box display='flex' flex='1' className='items-center justify-center ai-thread-empty'>
                <RecoveryState
                    title='Failed to load conversation'
                    description={error}
                    retryLabel={onRetry ? 'Retry' : undefined}
                    onRetry={onRetry}
                />
            </Box>
        );
    }

    let renderAfter: ReactNode = null;
    let autoScrollDependency = '';
    if (showStandaloneTyping) {
        renderAfter = (
            <Stack gap='025' className='ai-message-row is-assistant'>
                <ThinkingBubble />
            </Stack>
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
        <Stack as='section' flex='1' className='ai-thread-region' aria-label='Conversation messages'>
            {threadContent}

            <VisuallyHidden
                role='log'
                aria-live='polite'
                aria-relevant='additions text'
                aria-atomic='false'
            >
                {isResponding ? 'Assistant is responding.' : `Loaded ${normalizedMessages.length} messages.`}
            </VisuallyHidden>
        </Stack>
    );
};

export default AIConversationThread;
