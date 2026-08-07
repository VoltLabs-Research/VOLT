import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import { createTableArtifactComponents } from '@/modules/ai/components/AIConversationThread/markdown-table-artifact';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import ToolInvocationCard from '@/modules/ai/components/AIConversationThread/ToolInvocationCard';
import { Box, IconButton, Row, SectionLabel, Stack, Text, Tooltip, VisuallyHidden } from '@voltstack/bravais';
import { IoCheckmarkOutline, IoCopyOutline } from 'react-icons/io5';
import { memo, useState } from 'react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { NormalizedConversationMessage, ToolInvocation } from '@/modules/ai/utils/message-segments';
import type { ToolApprovalResponseParams } from '@/modules/ai/contracts/tools';
import type { ReactNode } from 'react';

const REMARK_PLUGINS = [remarkGfm];

const COPY_FEEDBACK_MS = 1600;

interface CopyMessageButtonProps {
    text: string;
}

const CopyMessageButton = ({ text }: CopyMessageButtonProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!text || !navigator.clipboard?.writeText) return;

        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
        }).catch(() => undefined);
    };

    return (
        <Tooltip content={copied ? 'Copied' : 'Copy message'} placement='top'>
            <IconButton
                variant='ghost'
                size='sm'
                className='ai-message-action'
                aria-label='Copy message'
                onClick={handleCopy}
            >
                {copied ? <IoCheckmarkOutline size={13} /> : <IoCopyOutline size={13} />}
            </IconButton>
        </Tooltip>
    );
};

interface AIMessageItemProps {
    message: NormalizedConversationMessage;
    messageIndex: number;
    totalMessages: number;
    onOpenTableArtifact?: (artifact: AIMessageArtifact) => void;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
}

const AIMessageItem = memo(({
    message,
    messageIndex,
    totalMessages,
    onOpenTableArtifact,
    addToolApprovalResponse
}: AIMessageItemProps) => {
    const isUser = message.role === AIMessageRole.User;
    const messageLabel = isUser ? 'You' : 'Assistant';
    const bubbleVariant = isUser ? 'is-user' : 'is-assistant';

    let markdownComponents = {};
    if (!isUser && onOpenTableArtifact) {
        markdownComponents = createTableArtifactComponents(message.id, onOpenTableArtifact);
    }

    const segmentElements: ReactNode[] = [];
    let segmentIndex = 0;

    while (segmentIndex < message.segments.length) {
        const segment = message.segments[segmentIndex];

        if (segment.type === 'reasoning') {
            segmentElements.push(
                <Box key={`seg-${segmentIndex}`} className='ai-message-reasoning'>
                    <SectionLabel className='ai-message-reasoning-label block'>
                        Thinking
                    </SectionLabel>
                    <Text as='div' size='sm' className='ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                            {segment.content}
                        </ReactMarkdown>
                    </Text>
                </Box>
            );
            segmentIndex += 1;
            continue;
        }

        if (segment.type === 'text') {
            segmentElements.push(
                <Box key={`seg-${segmentIndex}`} className={`ai-message-bubble ${bubbleVariant}`}>
                    <Box className='text-[0.95rem] ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
                            {segment.content}
                        </ReactMarkdown>
                    </Box>
                </Box>
            );
            segmentIndex += 1;
            continue;
        }

        const groupStart = segmentIndex;
        const invocations: ToolInvocation[] = [];
        let next = message.segments[segmentIndex];

        while (next?.type === 'tool') {
            invocations.push(next.invocation);
            segmentIndex += 1;
            next = message.segments[segmentIndex];
        }

        segmentElements.push(
            <Stack key={`seg-${groupStart}`} gap='05' className='ai-action-request-list'>
                {invocations.map((invocation, index) => (
                    <ToolInvocationCard
                        key={`${invocation.toolCallId}-${index}`}
                        invocation={invocation}
                        addToolApprovalResponse={addToolApprovalResponse}
                    />
                ))}
            </Stack>
        );
    }

    return (
        <article
            className={`flex flex-col gap-4 ai-message-row ${bubbleVariant}`}
            aria-label={`${messageLabel} message ${messageIndex + 1} of ${totalMessages}`}
        >
            <VisuallyHidden>
                {messageLabel}
            </VisuallyHidden>
            {segmentElements}
            {!isUser && message.segments.length === 0 && <ThinkingBubble />}
            {!isUser && message.preview.trim().length > 0 && (
                <Row gap='025' className='ai-message-actions'>
                    <CopyMessageButton text={message.preview} />
                </Row>
            )}
        </article>
    );
});

export default AIMessageItem;
