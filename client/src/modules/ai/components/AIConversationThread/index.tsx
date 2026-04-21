import {
    AIMessageArtifactKind,
    AIMessageRole
} from '@/modules/ai/api/entities/ai-conversation';
import {
    parseTableFromChildren,
    stringifyArtifactValue
} from '@/modules/ai/utilities/message-content';
import { resolveTabularPayload } from '@/modules/ai/utilities/message-artifacts';
import { isRecord } from '@/shared/utils/type-guards';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import Button from '@/shared/presentation/components/Button';
import RecoveryState from '@/shared/presentation/components/RecoveryState';
import { isToolUIPart } from 'ai';
import { IoExpandOutline } from 'react-icons/io5';
import { memo, useMemo } from 'react';
import remarkGfm from 'remark-gfm';
import ReactMarkdown from 'react-markdown';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import type { ParsedMarkdownTable } from '@/modules/ai/utilities/message-content';
import type { UIMessage } from 'ai';
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react';
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

interface AIArtifactImagePayload {
    url?: string;
    width?: number;
    height?: number;
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
    <div className='volt-container ai-message-bubble is-assistant ai-thinking-bubble'>
        <div className='volt-container d-flex items-center gap-025 ai-thinking-indicator' aria-label='Assistant is thinking'>
            <span className='ai-thinking-dot' />
            <span className='ai-thinking-dot' />
            <span className='ai-thinking-dot' />
        </div>
    </div>
);

const renderInlineArtifact = (artifact: AIMessageArtifact) => {
    const key = `${artifact.id}:inline`;
    const summary = artifact.summary || null;

    if (artifact.kind === AIMessageArtifactKind.Image) {
        let imageUrl: string | null = null;
        let imageWidth: number | undefined;
        let imageHeight: number | undefined;

        if (typeof artifact.payload === 'string') {
            imageUrl = artifact.payload;
        } else {
            const imagePayload = resolveImagePayload(artifact);

            if (imagePayload?.url) {
                imageUrl = imagePayload.url;
            }

            imageWidth = imagePayload?.width;
            imageHeight = imagePayload?.height;
        }

        let imageContent: ReactNode = (
            <p className='volt-text font-size-1 color-muted'>Image artifact is unavailable.</p>
        );

        if (imageUrl) {
            imageContent = (
                <img
                    src={imageUrl}
                    alt={artifact.title}
                    className='ai-inline-artifact-image'
                    loading='lazy'
                    decoding='async'
                    width={imageWidth}
                    height={imageHeight}
                />
            );
        }

        return (
            <div key={key} className='volt-container d-flex column gap-05 ai-inline-artifact-card'>
                <p className='volt-text font-size-1 text-uppercase color-muted'>
                    {artifact.title}
                </p>
                {summary && (
                    <p className='volt-text font-size-1 color-muted'>{summary}</p>
                )}
                {imageContent}
            </div>
        );
    }

    const payloadText = stringifyArtifactValue(artifact.payload);
    return (
        <div key={key} className='volt-container d-flex column gap-05 ai-inline-artifact-card'>
            <p className='volt-text font-size-1 text-uppercase color-muted'>
                {artifact.title}
            </p>
            {summary && (
                <p className='volt-text font-size-1 color-muted'>{summary}</p>
            )}
            <p className='volt-text font-size-1 ai-inline-artifact-payload'>{payloadText}</p>
        </div>
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
    messageIndex: number;
    totalMessages: number;
    onOpenTableArtifact?: (artifact: AIMessageArtifact) => void;
    activeTableArtifactId?: string | null;
    addToolApprovalResponse?: (params: ToolApprovalResponseParams) => void;
};

const VISUALLY_HIDDEN_STYLES: CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    border: 0
};

const resolveImagePayload = (artifact: AIMessageArtifact): AIArtifactImagePayload | null => {
    if (!isRecord(artifact.payload)) {
        return null;
    }

    const imagePayload: AIArtifactImagePayload = {};

    if (typeof artifact.payload.url === 'string') {
        imagePayload.url = artifact.payload.url;
    }

    if (typeof artifact.payload.width === 'number' && artifact.payload.width > 0) {
        imagePayload.width = artifact.payload.width;
    }

    if (typeof artifact.payload.height === 'number' && artifact.payload.height > 0) {
        imagePayload.height = artifact.payload.height;
    }

    return imagePayload;
};

const AIMessageItem = memo(({
    message,
    messageIndex,
    totalMessages,
    onOpenTableArtifact,
    activeTableArtifactId,
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
            <div key={artifact.id} className={`volt-container ${artifactCardClassName}`}>
                <div className='volt-container d-flex items-center content-between gap-05'>
                    <p className='volt-text font-size-1 text-uppercase color-muted'>
                        {artifact.title}
                    </p>
                    <p className='volt-text font-size-1 color-muted'>
                        {tablePayload.rows.length} rows · {tablePayload.columns.length} columns
                    </p>
                </div>

                {artifact.summary && (
                    <p className='volt-text font-size-1 color-muted'>
                        {artifact.summary}
                    </p>
                )}

                <div className='volt-container x-auto ai-table-artifact-preview-scroll'>
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
                </div>

                {hasMoreRows && (
                    <p className='volt-text font-size-1 color-muted'>
                        +{tablePayload.rows.length - previewRows.length} more rows
                    </p>
                )}

                {onOpenTableArtifact && (
                    <div className='volt-container d-flex content-end'>
                        <OpenSpreadsheetButton
                            isActive={isActive}
                            onClick={createOpenArtifactHandler(artifact)}
                        />
                    </div>
                )}
            </div>
        );
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

        return (
            <div key={`${toolCallId}-${index}`} className={`volt-container ai-action-request-card ${statusClass}`}>
                <div className='volt-container d-flex items-center gap-05 ai-action-request-header'>
                    <span className='ai-action-request-dot' />
                    <p className='volt-text font-size-1 color-muted'>
                        {actionLabel}
                        {toolInvocation.toolName}
                    </p>
                </div>

                {isApprovalRequested && addToolApprovalResponse && (
                    <div className='volt-container d-flex items-center gap-025 ai-action-request-controls'>
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
                    </div>
                )}

                {isExecuting && (
                    <div className='volt-container d-flex items-center gap-025 ai-action-request-controls'>
                        <p className='volt-text font-size-1 color-muted'>
                            Running...
                        </p>
                    </div>
                )}
            </div>
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
                <div key={`seg-${segIdx}`} className='volt-container ai-message-reasoning'>
                    <p className='volt-text font-size-1 text-uppercase color-muted ai-message-reasoning-label'>
                        Thinking
                    </p>
                    <div className='volt-container font-size-1 ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS}>
                            {segment.content}
                        </ReactMarkdown>
                    </div>
                </div>
            );
            segIdx++;
            continue;
        }

        if (segment.type === 'text') {
            segmentElements.push(
                <div key={`seg-${segIdx}`} className={`volt-container ai-message-bubble ${bubbleVariant}`}>
                    <div className='volt-container font-size-2-5 ai-message-text ai-message-markdown'>
                        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={mdComponents}>
                            {segment.content}
                        </ReactMarkdown>
                    </div>
                </div>
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
                <div key={`seg-${groupStart}`} className='volt-container d-flex column gap-05 ai-action-request-list'>
                    {tools.map(renderToolInvocation)}
                </div>
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
                <div key={`seg-${groupStart}`} className='volt-container d-flex column gap-05 ai-message-artifact-list'>
                    {artifacts.map(renderTableArtifact)}
                </div>
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
            <span style={VISUALLY_HIDDEN_STYLES}>
                {messageLabel}
            </span>
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
    activeTableArtifactId = null,
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
                <div className='volt-container ai-thread-starter-input'>
                    {starterInput}
                </div>
            );
        }

        return (
            <div className='volt-container d-flex flex-center flex-1 ai-thread-starter'>
                <div className='volt-container d-flex column items-center gap-2 ai-thread-starter-content'>
                    <p className='volt-text font-size-6 font-weight-5 color-primary ai-thread-starter-title'>
                        Ready when you are.
                    </p>
                    {starterContent}
                </div>
            </div>
        );
    };

    const renderMessageItem = (message: NormalizedConversationMessage, index: number) => (
        <AIMessageItem
            message={message}
            messageIndex={index}
            totalMessages={normalizedMessages.length}
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
            <div className='volt-container d-flex flex-center flex-1 ai-thread-empty'>
                <RecoveryState
                    title='Failed to load conversation'
                    description={error}
                    retryLabel={retryButtonText}
                    onRetry={onRetry}
                />
            </div>
        );
    }

    let renderAfter: ReactNode = null;
    if (showStandaloneTyping) {
        renderAfter = (
            <div className='volt-container d-flex column gap-025 ai-message-row is-assistant'>
                {renderThinkingBubble()}
            </div>
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
                    <div key={index} className='volt-container ai-message-skeleton' />
                ))}
                renderEmpty={renderPromptStarter()}
                renderAfter={renderAfter}
                renderItem={renderMessageItem}
            />

            <span
                style={VISUALLY_HIDDEN_STYLES}
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
