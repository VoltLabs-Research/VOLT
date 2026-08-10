import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import { createTableArtifactComponents } from '@/modules/ai/components/AIConversationThread/markdown-table-artifact';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import ToolInvocationCard from '@/modules/ai/components/AIConversationThread/ToolInvocationCard';
import {
    ACTION_REQUEST_LIST,
    MARKDOWN_PROSE,
    MESSAGE_ACTION,
    MESSAGE_ACTIONS,
    MESSAGE_BUBBLE,
    MESSAGE_BUBBLE_ASSISTANT,
    MESSAGE_BUBBLE_USER,
    MESSAGE_REASONING,
    MESSAGE_REASONING_LABEL,
    MESSAGE_ROW,
    MESSAGE_ROW_ASSISTANT,
    MESSAGE_ROW_USER,
    MESSAGE_TEXT,
    REASONING_PROSE
} from '@/modules/ai/components/AIConversationThread/thread-styles';
import { Button, Tooltip, cn } from '@heroui/react';
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
        <Tooltip>
            <Button
                isIconOnly
                variant='ghost'
                size='sm'
                className={MESSAGE_ACTION}
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
    const bubbleVariant = isUser ? MESSAGE_BUBBLE_USER : MESSAGE_BUBBLE_ASSISTANT;
    const rowVariant = isUser ? MESSAGE_ROW_USER : MESSAGE_ROW_ASSISTANT;

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
                <div className={MESSAGE_REASONING} key={`seg-${segmentIndex}`}>
                    <span className={MESSAGE_REASONING_LABEL}>
                        Thinking
                    </span>
                    <div className={cn('text-xs', MESSAGE_TEXT, MARKDOWN_PROSE, REASONING_PROSE)}>
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
                <div className={`${MESSAGE_BUBBLE} ${bubbleVariant}`} key={`seg-${segmentIndex}`}>
                    <div className={cn('text-[0.95rem]', MESSAGE_TEXT, MARKDOWN_PROSE)}>
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
            <div className={ACTION_REQUEST_LIST} key={`seg-${groupStart}`}>
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
            className={`${MESSAGE_ROW} ${rowVariant}`}
            aria-label={`${messageLabel} message ${messageIndex + 1} of ${totalMessages}`}
        >
            <span className='sr-only'>
                {messageLabel}
            </span>
            {segmentElements}
            {!isUser && message.segments.length === 0 && <ThinkingBubble />}
            {!isUser && message.preview.trim().length > 0 && (
                <div className={MESSAGE_ACTIONS}>
                    <CopyMessageButton text={message.preview} />
                </div>
            )}
        </article>
    );
});

export default AIMessageItem;
