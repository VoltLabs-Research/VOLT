import {
    AIMessageArtifactKind,
    AIMessageRole
} from '@/modules/ai/api/entities/ai-conversation';
import {
    parseTableFromChildren
} from '@/modules/ai/utilities/message-content';
import { isRecord } from '@/shared/utils/type-guards';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import RecoveryState from '@/shared/presentation/components/RecoveryState';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import SectionLabel from '@/shared/presentation/primitives/SectionLabel';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import Stack from '@/shared/presentation/primitives/Stack';
import StatusDot from '@/shared/presentation/primitives/StatusDot';
import Text from '@/shared/presentation/primitives/Text';
import ThinkingDots from '@/shared/presentation/primitives/ThinkingDots';
import VisuallyHidden from '@/shared/presentation/primitives/VisuallyHidden';
import { isToolUIPart } from 'ai';
import { IoExpandOutline } from 'react-icons/io5';
import { memo, useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { ParsedMarkdownTable } from '@/modules/ai/utilities/message-content';
import type { UIMessage } from 'ai';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import './AIConversationThread.css';

interface ToolApprovalResponseParams {
    id: string;
    approved: boolean;
    reason?: string;
}

interface AIConversationThreadProps {
    conversationId?: string;
    isLoading?: boolean;
    isResponding?: boolean;
    error?: string | null;
    messages: UIMessage[];
    onOpenTableArtifact?: (artifact: AIMessageArtifact) => void;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
    starterInput?: ReactNode;
    onRetry?: () => void;
}

interface NormalizedToolInvocation {
    toolCallId: string;
    approvalId?: string;
    toolName: string;
    state: string;
    args: unknown;
    result: unknown;
}

interface OpenSpreadsheetButtonProps {
    onClick: () => void;
    isActive?: boolean;
    embedded?: boolean;
}

interface TextPart {
    type: 'text';
    text: string;
}

interface ReasoningPart {
    type: 'reasoning';
    text: string;
}

interface MarkdownTableProps extends ComponentPropsWithoutRef<'table'> {
    children?: ReactNode;
}

interface TextSegment {
    type: 'text';
    content: string;
}

interface ReasoningSegment {
    type: 'reasoning';
    content: string;
}

interface ToolSegment {
    type: 'tool';
    invocation: NormalizedToolInvocation;
}

type MessageSegment = TextSegment | ReasoningSegment | ToolSegment;

interface NormalizedConversationMessage extends UIMessage {
    segments: MessageSegment[];
    preview: string;
    reasoning: string;
    toolInvocations: NormalizedToolInvocation[];
}

/** Stable reference to avoid re-creating the array on every render. */
const REMARK_PLUGINS = [remarkGfm];

const isTextPart = (part: UIMessage['parts'][number]): part is TextPart => {
    return part.type === 'text';
};

const isReasoningPart = (part: UIMessage['parts'][number]): part is ReasoningPart => {
    return part.type === 'reasoning';
};

const normalizeToolPart = (
    part: UIMessage['parts'][number],
    index: number
): NormalizedToolInvocation | null => {
    if (!isToolUIPart(part)) {
        return null;
    }

    let toolNameFromType = '';
    if (part.type.startsWith('tool-')) {
        toolNameFromType = part.type.slice(5);
    }

    let toolNameFromField = '';
    if ('toolName' in part && typeof part.toolName === 'string') {
        toolNameFromField = part.toolName;
    }

    const toolName = toolNameFromField || toolNameFromType || 'tool';

    const rawState = typeof part.state === 'string' ? part.state : '';
    let mappedState = rawState;
    if (rawState === 'output-available') {
        mappedState = 'result';
    } else if (rawState === 'output-error') {
        mappedState = 'output-denied';
    }

    let approvalId: string | undefined;
    if ('approvalId' in part && typeof part.approvalId === 'string') {
        approvalId = part.approvalId;
    } else if (
        'approval' in part
        && isRecord(part.approval)
        && typeof part.approval.id === 'string'
    ) {
        approvalId = part.approval.id;
    }

    let args: unknown = undefined;
    if ('input' in part) {
        args = part.input;
    }

    let result: unknown = undefined;
    if ('output' in part) {
        result = part.output;
    }

    return {
        toolCallId: part.toolCallId || approvalId || `tool-call-${index}`,
        approvalId,
        toolName,
        state: mappedState,
        args,
        result
    };
};

const renderThinkingBubble = () => (
    <Box className='ai-message-bubble is-assistant ai-thinking-bubble'>
        <ThinkingDots label='Assistant is thinking' />
    </Box>
);

const OpenSpreadsheetButton = ({
    onClick,
    isActive = false,
    embedded = false
}: OpenSpreadsheetButtonProps) => {
    let variant: 'solid' | 'soft' = 'soft';
    if (isActive) {
        variant = 'solid';
    }

    let shape: 'square' | 'rounded' = 'rounded';
    if (embedded) {
        shape = 'square';
    }

    let align: 'start' | 'center' = 'center';
    if (embedded) {
        align = 'start';
    }

    let className = '';
    if (embedded) {
        className = 'ai-open-spreadsheet-btn';
    }

    let label = 'Open spreadsheet';
    if (isActive) {
        label = 'Opened';
    }

    return (
        <Button
            type='button'
            size='sm'
            variant={variant}
            intent='brand'
            shape={shape}
            block={embedded}
            align={align}
            className={className}
            leftIcon={<IoExpandOutline size={13} />}
            onClick={onClick}
        >
            {label}
        </Button>
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
    let bubbleVariant = 'is-assistant';
    if (isUser) {
        bubbleVariant = 'is-user';
    }

    const createMarkdownComponents = (messageId: string) => {
        if (!onOpenTableArtifact) return {};

        let tableIndex = 0;

        return {
            table: ({ children, ...props }: MarkdownTableProps) => {
                let parsed: ParsedMarkdownTable | null = null;
                if (children) {
                    parsed = parseTableFromChildren(children);
                }

                const artifactId = `md-table:${messageId}:${tableIndex}`;
                tableIndex += 1;

                const handleOpen = () => {
                    if (!parsed) return;

                    const syntheticArtifact: AIMessageArtifact = {
                        id: artifactId,
                        messageId,
                        kind: AIMessageArtifactKind.Table,
                        title: 'Table',
                        payload: {
                            columns: parsed.columns,
                            rows: parsed.rows
                        }
                    };
                    onOpenTableArtifact(syntheticArtifact);
                };

                return (
                    <div className='ai-md-table-wrapper'>
                        <div className='ai-md-table-scroll'>
                            <table {...props}>{children}</table>
                        </div>
                        {parsed && parsed.rows.length > 0 && (
                            <OpenSpreadsheetButton onClick={handleOpen} embedded />
                        )}
                    </div>
                );
            }
        };
    };

    const createApproveHandler = (approvalResponseId: string, toolCallId: string) => () => {
        if (!addToolApprovalResponse) return;

        addToolApprovalResponse({ id: approvalResponseId, approved: true });

        if (approvalResponseId !== toolCallId) {
            addToolApprovalResponse({ id: toolCallId, approved: true });
        }
    };

    const createRejectHandler = (approvalResponseId: string, toolCallId: string) => () => {
        if (!addToolApprovalResponse) return;

        addToolApprovalResponse({
            id: approvalResponseId,
            approved: false,
            reason: 'User rejected the action.'
        });

        if (approvalResponseId !== toolCallId) {
            addToolApprovalResponse({
                id: toolCallId,
                approved: false,
                reason: 'User rejected the action.'
            });
        }
    };

    const renderToolInvocation = (toolInvocation: NormalizedToolInvocation, index: number) => {
        const toolCallId = toolInvocation.toolCallId;
        const actionState = toolInvocation.state;
        const approvalResponseId = toolInvocation.approvalId || toolCallId;
        const isComplete = actionState === 'result'
            || actionState === 'approved'
            || actionState === 'rejected'
            || actionState === 'output-denied'
            || actionState === 'approval-responded';
        const isApprovalRequested = actionState === 'approval-required'
            || actionState === 'approval-requested';
        const isApprovalFlow = isApprovalRequested
            || actionState === 'approval-responded'
            || actionState === 'output-denied';
        const isExecuting = !isComplete && !isApprovalRequested;
        const statusClass = `is-${actionState}`;

        let actionLabel = 'AI used tool: ';
        if (toolInvocation.toolName === 'navigate_to') {
            actionLabel = 'Navigation requested';
        } else if (toolInvocation.toolName === 'open_trajectory') {
            actionLabel = 'Trajectory open requested';
        } else if (isApprovalFlow) {
            actionLabel = 'AI requested action for tool: ';
        }

        let dotTone: 'warning' | 'success' | 'danger' = 'warning';
        if (actionState === 'approved') {
            dotTone = 'success';
        } else if (actionState === 'rejected' || actionState === 'failed' || actionState === 'output-denied') {
            dotTone = 'danger';
        }

        return (
            <Box key={`${toolCallId}-${index}`} className={`ai-action-request-card ${statusClass}`}>
                <Row gap='05' className='ai-action-request-header'>
                    <StatusDot tone={dotTone} size='sm' />
                    <Text as='p' size='sm' tone='muted'>
                        {actionLabel}
                        {toolInvocation.toolName}
                    </Text>
                </Row>

                {isApprovalRequested && addToolApprovalResponse && (
                    <Row gap='025' className='ai-action-request-controls'>
                        <Button
                            variant='solid'
                            intent='success'
                            size='sm'
                            onClick={createApproveHandler(approvalResponseId, toolCallId)}
                        >
                            Approve
                        </Button>
                        <Button
                            variant='outline'
                            intent='danger'
                            size='sm'
                            onClick={createRejectHandler(approvalResponseId, toolCallId)}
                        >
                            Reject
                        </Button>
                    </Row>
                )}

                {isExecuting && (
                    <Row gap='025' className='ai-action-request-controls'>
                        <Text as='p' size='sm' tone='muted'>
                            Running...
                        </Text>
                    </Row>
                )}
            </Box>
        );
    };

    let mdComponents = {};
    if (!isUser) {
        mdComponents = createMarkdownComponents(message.id);
    }

    const segmentElements: ReactNode[] = [];
    let segIdx = 0;

    while (segIdx < message.segments.length) {
        const segment = message.segments[segIdx];

        if (segment.type === 'reasoning') {
            segmentElements.push(
                <Box key={`seg-${segIdx}`} className='ai-message-reasoning'>
                    <SectionLabel className='ai-message-reasoning-label d-block'>
                        Thinking
                    </SectionLabel>
                    <Box className='font-size-1 ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                            {segment.content}
                        </ReactMarkdown>
                    </Box>
                </Box>
            );
            segIdx++;
            continue;
        }

        if (segment.type === 'text') {
            segmentElements.push(
                <Box key={`seg-${segIdx}`} className={`ai-message-bubble ${bubbleVariant}`}>
                    <Box className='font-size-2-5 ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={mdComponents}>
                            {segment.content}
                        </ReactMarkdown>
                    </Box>
                </Box>
            );
            segIdx++;
            continue;
        }

        if (segment.type === 'tool') {
            const groupStart = segIdx;
            const tools: NormalizedToolInvocation[] = [segment.invocation];
            segIdx++;
            while (segIdx < message.segments.length) {
                const next = message.segments[segIdx];
                if (next.type !== 'tool') break;
                tools.push(next.invocation);
                segIdx++;
            }
            segmentElements.push(
                <Stack key={`seg-${groupStart}`} gap='05' className='ai-action-request-list'>
                    {tools.map(renderToolInvocation)}
                </Stack>
            );
            continue;
        }

        segIdx++;
    }

    const showThinkingBubble = !isUser && message.segments.length === 0;

    return (
        <article
            className={`d-flex column gap-025 ai-message-row ${bubbleVariant}`}
            aria-label={`${messageLabel} message ${messageIndex + 1} of ${totalMessages}`}
        >
            <VisuallyHidden>
                {messageLabel}
            </VisuallyHidden>
            {segmentElements}
            {showThinkingBubble && renderThinkingBubble()}
        </article>
    );
});

const AIConversationThread = ({
    conversationId,
    isLoading = false,
    isResponding = false,
    error,
    messages,
    onOpenTableArtifact,
    addToolApprovalResponse,
    starterInput,
    onRetry
}: AIConversationThreadProps) => {
    const normalizedMessages = useMemo<NormalizedConversationMessage[]>(() => {
        const respondedToolCallIds = new Set<string>();
        for (const msg of messages) {
            if (msg.role !== 'user') continue;
            for (const part of msg.parts) {
                if (part.type === 'tool-result' && part.toolCallId) {
                    respondedToolCallIds.add(part.toolCallId);
                }
            }
        }

        const normalizeMessage = (message: UIMessage) => {
            const segments: MessageSegment[] = [];
            const toolInvocations: NormalizedToolInvocation[] = [];

            for (let i = 0; i < message.parts.length; i++) {
                const part = message.parts[i];

                if (isTextPart(part)) {
                    if (!part.text.trim()) continue;

                    const last = segments[segments.length - 1];
                    if (last && last.type === 'text') {
                        last.content += '\n' + part.text;
                    } else {
                        segments.push({ type: 'text', content: part.text });
                    }
                    continue;
                }

                if (isReasoningPart(part)) {
                    const last = segments[segments.length - 1];
                    if (last && last.type === 'reasoning') {
                        last.content += part.text;
                    } else {
                        segments.push({ type: 'reasoning', content: part.text });
                    }
                    continue;
                }

                const normalized = normalizeToolPart(part, i);
                if (normalized) {
                    if (respondedToolCallIds.has(normalized.toolCallId) && !['result', 'approved', 'rejected', 'output-denied'].includes(normalized.state)) {
                        normalized.state = 'approval-responded';
                    }
                    toolInvocations.push(normalized);
                    segments.push({ type: 'tool', invocation: normalized });
                }
            }

            const preview = segments
                .filter((s): s is TextSegment => s.type === 'text')
                .map((s) => s.content)
                .join('\n');

            const reasoning = segments
                .filter((s): s is ReasoningSegment => s.type === 'reasoning')
                .map((s) => s.content)
                .join('');

            return {
                ...message,
                segments,
                preview,
                reasoning,
                toolInvocations
            };
        };

        const mapped = messages.map(normalizeMessage);

        return mapped.reduce<NormalizedConversationMessage[]>((acc, msg) => {
            const prev = acc[acc.length - 1];
            if (!prev || prev.role !== AIMessageRole.Assistant || msg.role !== AIMessageRole.Assistant) {
                acc.push(msg);
                return acc;
            }

            prev.segments = [...prev.segments, ...msg.segments];
            prev.toolInvocations = [...prev.toolInvocations, ...msg.toolInvocations];

            if (prev.preview && msg.preview) {
                prev.preview += '\n' + msg.preview;
            } else if (msg.preview) {
                prev.preview = msg.preview;
            }

            if (msg.reasoning) {
                prev.reasoning += msg.reasoning;
            }

            return acc;
        }, []);
    }, [messages]);

    const streamCursor = useMemo(() => {
        const lastMessage = normalizedMessages[normalizedMessages.length - 1];
        if (!lastMessage) return '';

        return `${lastMessage.id}:${lastMessage.preview.length}:${lastMessage.reasoning.length}`;
    }, [normalizedMessages]);

    const showStandaloneTyping = useMemo(() => {
        if (!isResponding) return false;

        const last = normalizedMessages[normalizedMessages.length - 1];
        return !last || last.role === AIMessageRole.User;
    }, [isResponding, normalizedMessages]);

    const renderPromptStarter = () => {
        let starterContent: ReactNode = null;
        if (starterInput) {
            starterContent = (
                <Box className='ai-thread-starter-input'>
                    {starterInput}
                </Box>
            );
        }

        return (
            <Box display='flex' flex='1' className='flex-center ai-thread-starter'>
                <Stack align='center' gap='2' className='ai-thread-starter-content'>
                    <Text as='p' size='3xl' weight='medium' tone='primary' className='ai-thread-starter-title'>
                        Ready when you are.
                    </Text>
                    {starterContent}
                </Stack>
            </Box>
        );
    };

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
        let retryButtonText: string | undefined;
        if (onRetry) {
            retryButtonText = 'Retry';
        }

        return (
            <Box display='flex' flex='1' className='flex-center ai-thread-empty'>
                <RecoveryState
                    title='Failed to load conversation'
                    description={error}
                    retryLabel={retryButtonText}
                    onRetry={onRetry}
                />
            </Box>
        );
    }

    let renderAfter: ReactNode = null;
    if (showStandaloneTyping) {
        renderAfter = (
            <Stack gap='025' className='ai-message-row is-assistant'>
                {renderThinkingBubble()}
            </Stack>
        );
    }

    let autoScrollDependency = streamCursor;
    if (showStandaloneTyping) {
        autoScrollDependency = 'typing';
    }

    return (
        <section className='d-flex column flex-1 ai-thread-region' aria-label='Conversation messages'>
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
                renderEmpty={renderPromptStarter()}
                renderAfter={renderAfter}
                renderItem={renderMessageItem}
            />

            <VisuallyHidden
                role='log'
                aria-live='polite'
                aria-relevant='additions text'
                aria-atomic='false'
            >
                {isResponding ? 'Assistant is responding.' : `Loaded ${normalizedMessages.length} messages.`}
            </VisuallyHidden>
        </section>
    );
};

export default AIConversationThread;
