import {
    AIMessageArtifactKind,
    AIMessageRole
} from '@/modules/ai/api/entities/ai-conversation';
import {
    isRecord,
    parseTableFromChildren,
    stringifyArtifactValue
} from '@/modules/ai/utilities/message-content';
import { resolveTabularPayload } from '@/modules/ai/utilities/message-artifacts';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RecoveryState from '@/shared/presentation/components/RecoveryState';
import { isToolUIPart } from 'ai';
import { IoExpandOutline } from 'react-icons/io5';
import { memo, useMemo, useRef } from 'react';
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
};

interface AIConversationThreadProps {
    conversationId?: string;
    isLoading?: boolean;
    isResponding?: boolean;
    error?: string | null;
    messages: UIMessage[];
    onOpenTableArtifact?: (artifact: AIMessageArtifact) => void;
    activeTableArtifactId?: string | null;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
    starterInput?: ReactNode;
    onRetry?: () => void;
};

interface NormalizedToolInvocation {
    toolCallId: string;
    approvalId?: string;
    toolName: string;
    state: string;
    args: unknown;
    result: unknown;
};

interface OpenSpreadsheetButtonProps {
    onClick: () => void;
    isActive?: boolean;
    embedded?: boolean;
};

interface TextPart {
    type: 'text';
    text: string;
};

interface ReasoningPart {
    type: 'reasoning';
    text: string;
};

interface MarkdownTableProps extends ComponentPropsWithoutRef<'table'> {
    children?: ReactNode;
};

interface TextSegment {
    type: 'text';
    content: string;
};

interface ReasoningSegment {
    type: 'reasoning';
    content: string;
};

interface ToolSegment {
    type: 'tool';
    invocation: NormalizedToolInvocation;
};

interface ArtifactSegment {
    type: 'artifact';
    artifact: AIMessageArtifact;
};

type MessageSegment = TextSegment | ReasoningSegment | ToolSegment | ArtifactSegment;

interface NormalizedConversationMessage extends UIMessage {
    segments: MessageSegment[];
    preview: string;
    reasoning: string;
    artifacts: AIMessageArtifact[];
    toolInvocations: NormalizedToolInvocation[];
};

/** Stable reference to avoid re-creating the array on every render. */
const REMARK_PLUGINS = [remarkGfm];

const isTextPart = (part: UIMessage['parts'][number]): part is TextPart => {
    return isRecord(part) && part.type === 'text' && typeof part.text === 'string';
};

const isReasoningPart = (part: UIMessage['parts'][number]): part is ReasoningPart => {
    return isRecord(part) && part.type === 'reasoning' && typeof part.text === 'string';
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
    <Container className='ai-message-bubble is-assistant ai-thinking-bubble'>
        <Container className='d-flex items-center gap-025 ai-thinking-indicator' aria-label='Assistant is thinking'>
            <span className='ai-thinking-dot' />
            <span className='ai-thinking-dot' />
            <span className='ai-thinking-dot' />
        </Container>
    </Container>
);

const renderInlineArtifact = (artifact: AIMessageArtifact) => {
    const key = `${artifact.id}:inline`;
    const summary = artifact.summary || null;

    if (artifact.kind === AIMessageArtifactKind.Image) {
        let imageUrl: string | null = null;
        if (typeof artifact.payload === 'string') {
            imageUrl = artifact.payload;
        } else if (isRecord(artifact.payload) && typeof artifact.payload.url === 'string') {
            imageUrl = artifact.payload.url;
        }

        let imageContent: ReactNode = (
            <Paragraph className='font-size-1 color-muted'>Image artifact is unavailable.</Paragraph>
        );

        if (imageUrl) {
            imageContent = <img src={imageUrl} alt={artifact.title} className='ai-inline-artifact-image' />;
        }

        return (
            <Container key={key} className='d-flex column gap-05 ai-inline-artifact-card'>
                <Paragraph className='font-size-1 text-uppercase color-muted'>
                    {artifact.title}
                </Paragraph>
                {summary && (
                    <Paragraph className='font-size-1 color-muted'>{summary}</Paragraph>
                )}
                {imageContent}
            </Container>
        );
    }

    const payloadText = stringifyArtifactValue(artifact.payload);
    return (
        <Container key={key} className='d-flex column gap-05 ai-inline-artifact-card'>
            <Paragraph className='font-size-1 text-uppercase color-muted'>
                {artifact.title}
            </Paragraph>
            {summary && (
                <Paragraph className='font-size-1 color-muted'>{summary}</Paragraph>
            )}
            <Paragraph className='font-size-1 ai-inline-artifact-payload'>{payloadText}</Paragraph>
        </Container>
    );
};

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
    onOpenTableArtifact?: (artifact: AIMessageArtifact) => void;
    activeTableArtifactId?: string | null;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
};

/**
 * Compares AIMessageItem props to determine if re-rendering can be skipped.
 * During streaming only the last message changes — this prevents re-rendering
 * all historical messages on every chunk.
 */
const areMessagePropsEqual = (prev: AIMessageItemProps, next: AIMessageItemProps): boolean => {
    if (prev.message.id !== next.message.id) return false;
    if (prev.message.preview.length !== next.message.preview.length) return false;
    if (prev.message.reasoning.length !== next.message.reasoning.length) return false;
    if (prev.message.segments.length !== next.message.segments.length) return false;
    if (prev.activeTableArtifactId !== next.activeTableArtifactId) return false;
    if (prev.onOpenTableArtifact !== next.onOpenTableArtifact) return false;
    if (prev.addToolApprovalResponse !== next.addToolApprovalResponse) return false;

    const prevTools = prev.message.toolInvocations;
    const nextTools = next.message.toolInvocations;
    if (prevTools.length !== nextTools.length) return false;

    for (let i = 0; i < prevTools.length; i++) {
        if (prevTools[i].state !== nextTools[i].state) return false;
    }

    return true;
};

const AIMessageItem = memo(({
    message,
    onOpenTableArtifact,
    activeTableArtifactId,
    addToolApprovalResponse
}: AIMessageItemProps) => {
    const tableCounterRef = useRef(0);

    const isUser = message.role === AIMessageRole.User;
    let bubbleVariant = 'is-assistant';
    if (isUser) {
        bubbleVariant = 'is-user';
    }

    const createMarkdownComponents = (messageId: string) => {
        if (!onOpenTableArtifact) return {};

        return {
            table: ({ children, ...props }: MarkdownTableProps) => {
                let parsed: ParsedMarkdownTable | null = null;
                if (children) {
                    parsed = parseTableFromChildren(children);
                }

                const handleOpen = () => {
                    if (!parsed) return;

                    tableCounterRef.current += 1;
                    const syntheticArtifact: AIMessageArtifact = {
                        id: `md-table:${messageId}:${tableCounterRef.current}`,
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

    const createOpenArtifactHandler = (artifact: AIMessageArtifact) => () => {
        onOpenTableArtifact?.(artifact);
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

    const renderTableArtifact = (artifact: AIMessageArtifact) => {
        if (artifact.kind !== AIMessageArtifactKind.Table) {
            return renderInlineArtifact(artifact);
        }

        const tablePayload = resolveTabularPayload(artifact);
        if (!tablePayload) {
            return renderInlineArtifact(artifact);
        }

        const previewColumns = tablePayload.columns.slice(0, 4);
        const previewRows = tablePayload.rows.slice(0, 3);
        const hasMoreRows = tablePayload.rows.length > previewRows.length;
        const isActive = activeTableArtifactId === artifact.id;
        let artifactCardClassName = 'd-flex column gap-05 ai-table-artifact-card';
        if (isActive) {
            artifactCardClassName = 'd-flex column gap-05 ai-table-artifact-card is-active';
        }

        return (
            <Container
                key={artifact.id}
                className={artifactCardClassName}
            >
                <Container className='d-flex items-center content-between gap-05'>
                    <Paragraph className='font-size-1 text-uppercase color-muted'>
                        {artifact.title}
                    </Paragraph>
                    <Paragraph className='font-size-1 color-muted'>
                        {tablePayload.rows.length} rows · {tablePayload.columns.length} columns
                    </Paragraph>
                </Container>

                {artifact.summary && (
                    <Paragraph className='font-size-1 color-muted'>
                        {artifact.summary}
                    </Paragraph>
                )}

                <Container className='x-auto ai-table-artifact-preview-scroll'>
                    <table className='ai-table-artifact-preview'>
                        <thead>
                            <tr>
                                {previewColumns.map((column) => (
                                    <th key={`${artifact.id}:${column}`}>{column}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {previewRows.map((row, rowIndex) => (
                                <tr key={`${artifact.id}:row-${rowIndex}`}>
                                    {previewColumns.map((column) => (
                                        <td key={`${artifact.id}:${column}:${rowIndex}`}>
                                            {stringifyArtifactValue(row[column])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Container>

                {hasMoreRows && (
                    <Paragraph className='font-size-1 color-muted'>
                        +{tablePayload.rows.length - previewRows.length} more rows
                    </Paragraph>
                )}

                {onOpenTableArtifact && (
                    <Container className='d-flex content-end'>
                        <OpenSpreadsheetButton
                            isActive={isActive}
                            onClick={createOpenArtifactHandler(artifact)}
                        />
                    </Container>
                )}
            </Container>
        );
    };

    const renderToolInvocation = (toolInvocation: NormalizedToolInvocation, index: number) => {
        const toolCallId = toolInvocation.toolCallId;
        const actionState = toolInvocation.state;
        const approvalResponseId = toolInvocation.approvalId || toolCallId;
        const isComplete = actionState === 'result'
            || actionState === 'approved'
            || actionState === 'rejected'
            || actionState === 'output-denied';
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

        return (
            <Container key={`${toolCallId}-${index}`} className={`ai-action-request-card ${statusClass}`}>
                <Container className='d-flex items-center gap-05 ai-action-request-header'>
                    <span className='ai-action-request-dot' />
                    <Paragraph className='font-size-1 color-muted'>
                        {actionLabel}
                        {toolInvocation.toolName}
                    </Paragraph>
                </Container>

                {isApprovalRequested && addToolApprovalResponse && (
                    <Container className='d-flex items-center gap-025 ai-action-request-controls'>
                        <button
                            type='button'
                            className='ai-action-request-btn is-approve'
                            onClick={createApproveHandler(approvalResponseId, toolCallId)}
                        >
                            Approve
                        </button>
                        <button
                            type='button'
                            className='ai-action-request-btn is-reject'
                            onClick={createRejectHandler(approvalResponseId, toolCallId)}
                        >
                            Reject
                        </button>
                    </Container>
                )}

                {isExecuting && (
                    <Container className='d-flex items-center gap-025 ai-action-request-controls'>
                        <Paragraph className='font-size-1 color-muted'>
                            Running...
                        </Paragraph>
                    </Container>
                )}
            </Container>
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
                <Container key={`seg-${segIdx}`} className='ai-message-reasoning'>
                    <Paragraph className='font-size-1 text-uppercase color-muted ai-message-reasoning-label'>
                        Thinking
                    </Paragraph>
                    <Container className='font-size-1 ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                            {segment.content}
                        </ReactMarkdown>
                    </Container>
                </Container>
            );
            segIdx++;
            continue;
        }

        if (segment.type === 'text') {
            segmentElements.push(
                <Container key={`seg-${segIdx}`} className={`ai-message-bubble ${bubbleVariant}`}>
                    <Container className='font-size-2-5 ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={mdComponents}>
                            {segment.content}
                        </ReactMarkdown>
                    </Container>
                </Container>
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
                <Container key={`seg-${groupStart}`} className='d-flex column gap-05 ai-action-request-list'>
                    {tools.map(renderToolInvocation)}
                </Container>
            );
            continue;
        }

        if (segment.type === 'artifact') {
            const groupStart = segIdx;
            const artifacts: AIMessageArtifact[] = [segment.artifact];
            segIdx++;
            while (segIdx < message.segments.length) {
                const next = message.segments[segIdx];
                if (next.type !== 'artifact') break;
                artifacts.push(next.artifact);
                segIdx++;
            }
            segmentElements.push(
                <Container key={`seg-${groupStart}`} className='d-flex column gap-05 ai-message-artifact-list'>
                    {artifacts.map(renderTableArtifact)}
                </Container>
            );
            continue;
        }

        segIdx++;
    }

    const showThinkingBubble = !isUser && message.segments.length === 0;

    return (
        <Container className={`d-flex column gap-025 ai-message-row ${bubbleVariant}`}>
            {segmentElements}
            {showThinkingBubble && renderThinkingBubble()}
        </Container>
    );
}, areMessagePropsEqual);

const AIConversationThread = ({
    conversationId,
    isLoading = false,
    isResponding = false,
    error,
    messages,
    onOpenTableArtifact,
    activeTableArtifactId = null,
    addToolApprovalResponse,
    starterInput,
    onRetry
}: AIConversationThreadProps) => {
    const normalizedMessages = useMemo<NormalizedConversationMessage[]>(() => {
        const normalizeMessage = (message: UIMessage) => {
            const segments: MessageSegment[] = [];
            const toolInvocations: NormalizedToolInvocation[] = [];
            const artifacts: AIMessageArtifact[] = [];

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
                artifacts,
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
            prev.artifacts = [...prev.artifacts, ...msg.artifacts];

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
                <Container className='ai-thread-starter-input'>
                    {starterInput}
                </Container>
            );
        }

        return (
            <Container className='d-flex flex-center flex-1 ai-thread-starter'>
                <Container className='d-flex column items-center gap-2 ai-thread-starter-content'>
                    <Paragraph className='font-size-6 font-weight-5 color-primary ai-thread-starter-title'>
                        Ready when you are.
                    </Paragraph>
                    {starterContent}
                </Container>
            </Container>
        );
    };

    const renderMessageItem = (message: NormalizedConversationMessage) => (
        <AIMessageItem
            message={message}
            onOpenTableArtifact={onOpenTableArtifact}
            activeTableArtifactId={activeTableArtifactId}
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
            <Container className='d-flex flex-center flex-1 ai-thread-empty'>
                <RecoveryState
                    title='Failed to load conversation'
                    description={error}
                    retryLabel={retryButtonText}
                    onRetry={onRetry}
                />
            </Container>
        );
    }

    let renderAfter: ReactNode = null;
    if (showStandaloneTyping) {
        renderAfter = (
            <Container className='d-flex column gap-025 ai-message-row is-assistant'>
                {renderThinkingBubble()}
            </Container>
        );
    }

    let autoScrollDependency = streamCursor;
    if (showStandaloneTyping) {
        autoScrollDependency = 'typing';
    }

    return (
        <AutoScrollList
            items={normalizedMessages}
            isLoading={isLoading}
            className='ai-thread-list'
            getItemKey={(message) => message.id}
            autoScrollDependency={autoScrollDependency}
            autoScrollDependencyEnabled={isResponding || showStandaloneTyping}
            renderLoading={Array.from({ length: 4 }).map((_, index) => (
                <Container key={index} className='ai-message-skeleton' />
            ))}
            renderEmpty={renderPromptStarter()}
            renderAfter={renderAfter}
            renderItem={renderMessageItem}
        />
    );
};

export default AIConversationThread;
