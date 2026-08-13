import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import { createTableArtifactComponents } from '@/modules/ai/components/AIConversationThread/markdown-table-artifact';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import ToolInvocationCard from '@/modules/ai/components/AIConversationThread/ToolInvocationCard';
import Prose from '@/shared/ui/components/Prose';
import { Button, Tooltip, cn } from '@heroui/react';
import { Check, ChevronRight, Copy } from 'lucide-react';
import { memo, useState } from 'react';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import type { NormalizedConversationMessage, ToolInvocation } from '@/modules/ai/utils/message-segments';
import type { ToolApprovalResponseParams } from '@/modules/ai/contracts/tools';
import type { ReactNode } from 'react';

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
        <Tooltip>
            <Button
                isIconOnly
                variant='ghost'
                size='sm'
                className='text-muted'
                aria-label='Copy message'
                onPress={handleCopy}
            >
                {copied ? <Check size={13} /> : <Copy size={13} />}
            </Button>
            <Tooltip.Content placement='top'>{copied ? 'Copied' : 'Copy message'}</Tooltip.Content>
        </Tooltip>
    );
};

/*
 * Reasoning is collapsed by default. It is context for the answer, not the
 * answer, and left expanded it pushed the reply below the fold on every turn.
 */
const ReasoningSegment = ({ content }: { content: string }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className='flex w-full flex-col gap-1'>
            <button
                type='button'
                onClick={() => setIsOpen((value) => !value)}
                aria-expanded={isOpen}
                className='flex w-fit cursor-pointer flex-row items-center gap-1 rounded-md border-none bg-transparent p-0 text-2xs text-muted hover:text-foreground'
            >
                <ChevronRight size={11} aria-hidden='true' className={cn('transition-transform duration-200', isOpen && 'rotate-90')} />
                {isOpen ? 'Hide reasoning' : 'Show reasoning'}
            </button>

            {isOpen && (
                <div className='border-l-2 border-border pl-3'>
                    <Prose size='sm'>{content}</Prose>
                </div>
            )}
        </div>
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

    const markdownComponents = !isUser && onOpenTableArtifact
        ? createTableArtifactComponents(message.id, onOpenTableArtifact)
        : undefined;

    const segmentElements: ReactNode[] = [];
    let segmentIndex = 0;

    while (segmentIndex < message.segments.length) {
        const segment = message.segments[segmentIndex];

        if (segment.type === 'reasoning') {
            segmentElements.push(
                <ReasoningSegment key={`seg-${segmentIndex}`} content={segment.content} />
            );
            segmentIndex += 1;
            continue;
        }

        if (segment.type === 'text') {
            /*
             * Only the user gets a bubble. The assistant's turn is the page's main
             * text — boxing it would add a frame around nearly everything on screen
             * and cap the width of tables and code blocks that need the room.
             */
            segmentElements.push(
                <div
                    key={`seg-${segmentIndex}`}
                    className={cn(
                        'min-w-0',
                        isUser
                            ? 'max-w-[80%] rounded-xl bg-surface-secondary px-4 py-2.5 max-md:max-w-[88%]'
                            : 'w-full'
                    )}
                >
                    <Prose components={markdownComponents}>{segment.content}</Prose>
                </div>
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
            <div className='flex w-full flex-col gap-2' key={`seg-${groupStart}`}>
                {invocations.map((invocation, index) => (
                    <ToolInvocationCard
                        key={`${invocation.toolCallId}-${index}`}
                        invocation={invocation}
                        addToolApprovalResponse={addToolApprovalResponse}
                    />
                ))}
            </div>
        );
    }

    return (
        <article
            className={cn(
                'group/message flex min-w-0 flex-col gap-2',
                isUser ? 'items-end' : 'items-start'
            )}
            aria-label={`${messageLabel} message ${messageIndex + 1} of ${totalMessages}`}
        >
            <span className='sr-only'>{messageLabel}</span>

            {segmentElements}

            {!isUser && message.segments.length === 0 && <ThinkingBubble />}

            {!isUser && message.preview.trim().length > 0 && (
                <div className='flex flex-row items-center gap-1 opacity-0 transition-opacity duration-[120ms] group-hover/message:opacity-100 group-focus-within/message:opacity-100 [@media(hover:none)]:opacity-100'>
                    <CopyMessageButton text={message.preview} />
                </div>
            )}
        </article>
    );
});

export default AIMessageItem;
