import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import { createTableArtifactComponents } from '@/modules/ai/components/AIConversationThread/markdown-table-artifact';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import ToolInvocationCard from '@/modules/ai/components/AIConversationThread/ToolInvocationCard';
import { IconButton, Tooltip } from '@voltstack/bravais';
import { Check, Copy } from 'lucide-react';
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
                {copied ? <Check size={13} /> : <Copy size={13} />}
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
                <div className='ai-message-reasoning' key={`seg-${segmentIndex}`}>
                    <span className='text-xs font-semibold uppercase tracking-[0.05em] text-muted ai-message-reasoning-label block'>
                        Thinking
                    </span>
                    <div className='text-xs ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                            {segment.content}
                        </ReactMarkdown>
                    </div>
                </div>
            );
            segmentIndex += 1;
            continue;
        }

        if (segment.type === 'text') {
            segmentElements.push(
                <div className={`ai-message-bubble ${bubbleVariant}`} key={`seg-${segmentIndex}`}>
                    <div className='text-[0.95rem] ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>
                            {segment.content}
                        </ReactMarkdown>
                    </div>
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
            <div className='flex flex-col gap-2 ai-action-request-list' key={`seg-${groupStart}`}>
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
            className={`flex flex-col gap-4 ai-message-row ${bubbleVariant}`}
            aria-label={`${messageLabel} message ${messageIndex + 1} of ${totalMessages}`}
        >
            <span className='sr-only'>
                {messageLabel}
            </span>
            {segmentElements}
            {!isUser && message.segments.length === 0 && <ThinkingBubble />}
            {!isUser && message.preview.trim().length > 0 && (
                <div className='flex flex-row items-center gap-1 ai-message-actions'>
                    <CopyMessageButton text={message.preview} />
                </div>
            )}
        </article>
    );
});

export default AIMessageItem;
