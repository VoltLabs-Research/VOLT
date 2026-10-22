import { createTableArtifactComponents } from '@/modules/ai/components/AIConversationThread/markdown-table-artifact';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import ToolApprovalCard from '@/modules/ai/components/AIConversationThread/ToolApprovalCard';
import WorkTrace from '@/modules/ai/components/AIConversationThread/WorkTrace';
import { blocksOf } from '@/modules/ai/utils/message-blocks';
import { textOf } from '@/modules/ai/utils/transcript';
import Prose from '@/shared/ui/components/Prose';
import { Button, Tooltip, cn } from '@heroui/react';
import { Check, Copy } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import type { AITableArtifact } from '@/modules/ai/contracts/artifacts';
import type { ChatUIMessage } from '@volt/contracts/modules/ai/chat';

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

interface AIMessageItemProps {
    message: ChatUIMessage;
    messageIndex: number;
    totalMessages: number;
    // The reply still streaming: until it shows anything, it shows that it is thinking.
    isStreaming: boolean;
    canDecide: boolean;
    onDecide: (approvalIds: string[], approved: boolean) => void;
    onOpenTableArtifact?: (artifact: AITableArtifact) => void;
}

const AIMessageItem = memo(({
    message,
    messageIndex,
    totalMessages,
    isStreaming,
    canDecide,
    onDecide,
    onOpenTableArtifact
}: AIMessageItemProps) => {
    const isUser = message.role === 'user';
    const messageLabel = isUser ? 'You' : 'Assistant';
    const blocks = useMemo(() => blocksOf(message), [message]);
    const text = useMemo(() => textOf(message), [message]);

    const markdownComponents = !isUser && onOpenTableArtifact
        ? createTableArtifactComponents(message.id, onOpenTableArtifact)
        : undefined;

    return (
        <article
            className={cn(
                'group/message flex min-w-0 flex-col gap-2',
                isUser ? 'items-end' : 'items-start'
            )}
            aria-label={`${messageLabel} message ${messageIndex + 1} of ${totalMessages}`}
        >
            <span className='sr-only'>{messageLabel}</span>

            {blocks.map((block, index) => {
                if (block.kind === 'text') {
                    return (
                        <div
                            key={`text-${index}`}
                            className={cn(
                                'min-w-0',
                                isUser
                                    ? 'max-w-[80%] rounded-xl bg-surface-secondary px-4 py-2.5 max-md:max-w-[88%]'
                                    : 'w-full'
                            )}
                        >
                            <Prose components={markdownComponents}>{block.text}</Prose>
                        </div>
                    );
                }

                if (block.kind === 'work') {
                    return <WorkTrace key={`work-${index}`} steps={block.steps} />;
                }

                return (
                    <ToolApprovalCard
                        key={block.activities[0].toolCallId}
                        activities={block.activities}
                        canDecide={canDecide}
                        onDecide={onDecide}
                    />
                );
            })}

            {!isUser && isStreaming && blocks.length === 0 && <ThinkingBubble />}

            {!isUser && !isStreaming && text.length > 0 && (
                <div className='flex flex-row items-center gap-1 opacity-0 transition-opacity duration-[120ms] group-hover/message:opacity-100 group-focus-within/message:opacity-100 [@media(hover:none)]:opacity-100'>
                    <CopyMessageButton text={text} />
                </div>
            )}
        </article>
    );
});

export default AIMessageItem;
