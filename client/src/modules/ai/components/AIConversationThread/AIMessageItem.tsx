import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import { createTableArtifactComponents } from '@/modules/ai/components/AIConversationThread/markdown-table-artifact';
import ThinkingBubble from '@/modules/ai/components/AIConversationThread/ThinkingBubble';
import ToolInvocationCard from '@/modules/ai/components/AIConversationThread/ToolInvocationCard';
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
                <div className='w-full rounded-none border-none bg-transparent px-0 pt-0 pb-[0.2rem] text-muted' key={`seg-${segmentIndex}`}>
                    <span className='mb-[0.1rem] block text-xs font-semibold uppercase tracking-[0.05em] text-muted'>
                        Thinking
                    </span>
                    <div className={cn(
                        'text-xs',
                        'break-words',
                        'm-0 w-full overflow-x-auto leading-[1.55]',
                        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
                        '[&_p]:my-[0.3rem] [&_p+p]:mt-[0.4rem]',
                        '[&_ul]:my-[0.3rem] [&_ul]:pl-5 [&_ol]:my-[0.3rem] [&_ol]:pl-5',
                        '[&_li]:m-0 [&_li]:pl-[0.15rem] [&_li+li]:mt-[0.1rem] [&_li>p]:m-0',
                        '[&_li>ul]:mt-[0.1rem] [&_li>ul]:mb-0 [&_li>ol]:mt-[0.1rem] [&_li>ol]:mb-0',
                        '[&_:is(h1,h2,h3,h4,h5,h6)]:mx-0 [&_:is(h1,h2,h3,h4,h5,h6)]:mt-[0.6rem] [&_:is(h1,h2,h3,h4,h5,h6)]:mb-1',
                        '[&_:is(h1,h2,h3,h4,h5,h6)]:leading-[1.3] [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:text-foreground',
                        '[&_h1]:text-[1.3em] [&_h2]:text-[1.15em] [&_h3]:text-[1.05em] [&_:is(h4,h5,h6)]:text-[1em]',
                        '[&_code]:font-mono [&_code]:text-[0.85em]',
                        '[&_pre]:my-[0.4rem] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-background [&_pre]:px-3 [&_pre]:py-[0.6rem]',
                        '[&_pre_code]:whitespace-pre [&_pre_code]:text-[0.74rem]',
                        '[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:border [&_:not(pre)>code]:border-border [&_:not(pre)>code]:bg-surface-secondary [&_:not(pre)>code]:px-[0.3rem] [&_:not(pre)>code]:py-[0.1rem]',
                        '[&_a]:text-foreground [&_a]:underline',
                        '[&_blockquote]:my-[0.4rem] [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:py-[0.15rem] [&_blockquote]:pr-0 [&_blockquote]:pl-3 [&_blockquote]:text-muted',
                        '[&_blockquote>*:first-child]:mt-0 [&_blockquote>*:last-child]:mb-0',
                        '[&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border',
                        '[&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-border [&_table]:border-collapse [&_table]:text-[0.82em]',
                        '[&_thead]:bg-surface-secondary',
                        '[&_th]:border-b [&_th]:border-border [&_th]:px-[0.6rem] [&_th]:py-[0.4rem] [&_th]:text-left [&_th]:text-[0.9em] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.03em] [&_th]:text-muted',
                        '[&_td]:border-b [&_td]:border-border [&_td]:px-[0.6rem] [&_td]:py-[0.35rem]',
                        '[&_tr:last-child_td]:border-b-0',
                        '[&_tbody_tr:hover]:bg-surface-hover',
                        '[&_strong]:font-semibold [&_strong]:text-foreground',
                        'text-muted opacity-90 [&_p]:my-[0.15rem] [&_p+p]:mt-[0.15rem] [&_ul]:my-[0.15rem] [&_ol]:my-[0.15rem] [&_pre]:my-[0.15rem] [&_blockquote]:my-[0.15rem]'
                    )}>
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
                <div
                    className={cn(
                        'min-w-0 max-w-full overflow-hidden rounded-2xl px-[0.95rem] py-3 leading-[1.55] whitespace-normal',
                        isUser ? 'bg-surface-secondary text-foreground' : 'border-none bg-transparent pl-0 text-foreground'
                    )}
                    key={`seg-${segmentIndex}`}
                >
                    <div className={cn(
                        'text-[0.95rem]',
                        'break-words',
                        'm-0 w-full overflow-x-auto leading-[1.55]',
                        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
                        '[&_p]:my-[0.3rem] [&_p+p]:mt-[0.4rem]',
                        '[&_ul]:my-[0.3rem] [&_ul]:pl-5 [&_ol]:my-[0.3rem] [&_ol]:pl-5',
                        '[&_li]:m-0 [&_li]:pl-[0.15rem] [&_li+li]:mt-[0.1rem] [&_li>p]:m-0',
                        '[&_li>ul]:mt-[0.1rem] [&_li>ul]:mb-0 [&_li>ol]:mt-[0.1rem] [&_li>ol]:mb-0',
                        '[&_:is(h1,h2,h3,h4,h5,h6)]:mx-0 [&_:is(h1,h2,h3,h4,h5,h6)]:mt-[0.6rem] [&_:is(h1,h2,h3,h4,h5,h6)]:mb-1',
                        '[&_:is(h1,h2,h3,h4,h5,h6)]:leading-[1.3] [&_:is(h1,h2,h3,h4,h5,h6)]:font-semibold [&_:is(h1,h2,h3,h4,h5,h6)]:text-foreground',
                        '[&_h1]:text-[1.3em] [&_h2]:text-[1.15em] [&_h3]:text-[1.05em] [&_:is(h4,h5,h6)]:text-[1em]',
                        '[&_code]:font-mono [&_code]:text-[0.85em]',
                        '[&_pre]:my-[0.4rem] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-border [&_pre]:bg-background [&_pre]:px-3 [&_pre]:py-[0.6rem]',
                        '[&_pre_code]:whitespace-pre [&_pre_code]:text-[0.74rem]',
                        '[&_:not(pre)>code]:rounded-md [&_:not(pre)>code]:border [&_:not(pre)>code]:border-border [&_:not(pre)>code]:bg-surface-secondary [&_:not(pre)>code]:px-[0.3rem] [&_:not(pre)>code]:py-[0.1rem]',
                        '[&_a]:text-foreground [&_a]:underline',
                        '[&_blockquote]:my-[0.4rem] [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:py-[0.15rem] [&_blockquote]:pr-0 [&_blockquote]:pl-3 [&_blockquote]:text-muted',
                        '[&_blockquote>*:first-child]:mt-0 [&_blockquote>*:last-child]:mb-0',
                        '[&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border',
                        '[&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-border [&_table]:border-collapse [&_table]:text-[0.82em]',
                        '[&_thead]:bg-surface-secondary',
                        '[&_th]:border-b [&_th]:border-border [&_th]:px-[0.6rem] [&_th]:py-[0.4rem] [&_th]:text-left [&_th]:text-[0.9em] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.03em] [&_th]:text-muted',
                        '[&_td]:border-b [&_td]:border-border [&_td]:px-[0.6rem] [&_td]:py-[0.35rem]',
                        '[&_tr:last-child_td]:border-b-0',
                        '[&_tbody_tr:hover]:bg-surface-hover',
                        '[&_strong]:font-semibold [&_strong]:text-foreground'
                    )}>
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
                'group/message flex min-w-0 max-w-full flex-col gap-4 max-md:max-w-[90%] [.ai-floating-assistant_&]:max-w-[92%]',
                isUser ? 'ml-auto items-end' : 'mr-auto items-start'
            )}
            aria-label={`${messageLabel} message ${messageIndex + 1} of ${totalMessages}`}
        >
            <span className='sr-only'>
                {messageLabel}
            </span>
            {segmentElements}
            {!isUser && message.segments.length === 0 && <ThinkingBubble />}
            {!isUser && message.preview.trim().length > 0 && (
                <div className='mt-[0.15rem] flex flex-row items-center gap-1 opacity-0 transition-opacity duration-[120ms] group-hover/message:opacity-100 group-focus-within/message:opacity-100 [@media(hover:none)]:opacity-100'>
                    <CopyMessageButton text={message.preview} />
                </div>
            )}
        </article>
    );
});

export default AIMessageItem;
