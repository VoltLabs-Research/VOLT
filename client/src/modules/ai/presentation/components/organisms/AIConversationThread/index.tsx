import { type ReactNode, useCallback, useMemo, useRef } from 'react';
import { isToolUIPart, type UIMessage } from 'ai';
import type { AIMessageArtifact } from '@/modules/ai/domain/entities/AIConversation';
import { resolveTabularPayload } from '@/modules/ai/presentation/utilities/message-artifacts';
import { IoExpandOutline } from 'react-icons/io5';
import Button from '@/shared/presentation/components/Button';
import AutoScrollList from '@/shared/presentation/components/AutoScrollList';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Paragraph from '@/shared/presentation/components/Paragraph';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    isRecord,
    parseTableFromChildren,
    stringifyArtifactValue
} from './thread-utils';
import './AIConversationThreadArtifacts.css';

interface AIConversationThreadProps {
    conversationId?: string;
    isLoading?: boolean;
    isResponding?: boolean;
    error?: string | null;
    messages: UIMessage[];
    onOpenTableArtifact?: (artifact: AIMessageArtifact) => void;
    activeTableArtifactId?: string | null;
    addToolApprovalResponse?: (params: { id: string; approved: boolean; reason?: string }) => void;
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

const normalizeToolPart = (
    part: UIMessage['parts'][number],
    index: number
): NormalizedToolInvocation | null => {
    if (!isToolUIPart(part)) {
        return null;
    }

    const toolNameFromType = part.type.startsWith('tool-')
        ? part.type.slice(5)
        : '';
    const toolNameFromField = (
        'toolName' in part && typeof part.toolName === 'string'
    )
        ? part.toolName
        : '';
    const toolName = toolNameFromField || toolNameFromType || 'tool';

    const rawState = typeof part.state === 'string' ? part.state : '';
    const mappedState = (
        rawState === 'output-available'
            ? 'result'
            : rawState === 'output-error'
                ? 'output-denied'
                : rawState
    );

    const approvalId = (
        'approvalId' in part
        && typeof part.approvalId === 'string'
    )
        ? part.approvalId
        : (
            'approval' in part
            && isRecord(part.approval)
            && typeof part.approval.id === 'string'
    )
        ? part.approval.id
        : undefined;

    return {
        toolCallId: part.toolCallId || approvalId || `tool-call-${index}`,
        approvalId,
        toolName,
        state: mappedState,
        args: 'input' in part ? part.input : undefined,
        result: 'output' in part ? part.output : undefined
    };
};

const renderInlineArtifact = (artifact: AIMessageArtifact) => {
    const key = `${artifact.id}:inline`;
    const summary = artifact.summary || null;

    if (artifact.kind === 'image') {
        const imageUrl = typeof artifact.payload === 'string'
            ? artifact.payload
            : (
                isRecord(artifact.payload) && typeof artifact.payload.url === 'string'
                    ? artifact.payload.url
                    : null
            );

        return (
            <Container key={key} className='d-flex column gap-05 ai-inline-artifact-card'>
                <Paragraph className='font-size-1 text-uppercase color-muted'>
                    {artifact.title}
                </Paragraph>
                {summary && (
                    <Paragraph className='font-size-1 color-muted'>{summary}</Paragraph>
                )}
                {imageUrl ? (
                    <img src={imageUrl} alt={artifact.title} className='ai-inline-artifact-image' />
                ) : (
                    <Paragraph className='font-size-1 color-muted'>Image artifact is unavailable.</Paragraph>
                )}
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

interface OpenSpreadsheetButtonProps {
    onClick: () => void;
    isActive?: boolean;
    embedded?: boolean;
}

const OpenSpreadsheetButton = ({
    onClick,
    isActive = false,
    embedded = false
}: OpenSpreadsheetButtonProps) => (
    <Button
        type='button'
        size='sm'
        variant={isActive ? 'solid' : 'soft'}
        intent='brand'
        shape={embedded ? 'square' : 'rounded'}
        block={embedded}
        align={embedded ? 'start' : 'center'}
        className={embedded ? 'ai-open-spreadsheet-btn' : ''}
        leftIcon={<IoExpandOutline size={13} />}
        onClick={onClick}
    >
        {isActive ? 'Opened' : 'Open spreadsheet'}
    </Button>
);

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
    const tableCounterRef = useRef(0);

    const normalizedMessages = useMemo(() => {
        return messages
            .map((message) => {
                const toolInvocations = Array.isArray(message.parts)
                    ? message.parts
                        .flatMap((part, index) => {
                            const normalized = normalizeToolPart(part, index);
                            return normalized ? [normalized] : [];
                        })
                    : [];

                return {
                    ...message,
                    preview: message.parts
                        .filter((part): part is { type: 'text'; text: string } => (
                            isRecord(part) && part.type === 'text' && typeof part.text === 'string'
                        ))
                        .map((part) => part.text)
                        .filter((text) => Boolean(text.trim()))
                        .join('\n'),
                    reasoning: message.parts
                        .filter((part): part is { type: 'reasoning'; text: string } => (
                            isRecord(part) && part.type === 'reasoning' && typeof part.text === 'string'
                        ))
                        .map((part) => part.text)
                        .join(''),
                    artifacts: [] as AIMessageArtifact[],
                    toolInvocations
                };
            });
    }, [messages]);

    const streamCursor = useMemo(() => {
        const lastMessage = normalizedMessages[normalizedMessages.length - 1];
        if (!lastMessage) return '';
        return [
            lastMessage.id,
            lastMessage.preview || '',
            lastMessage.reasoning || ''
        ].join(':');
    }, [normalizedMessages]);

    // Show a standalone typing indicator when the AI is responding but no
    // assistant message has appeared yet (the "submitted" phase before
    // the first streamed token arrives).
    const showStandaloneTyping = useMemo(() => {
        if (!isResponding) return false;
        const last = normalizedMessages[normalizedMessages.length - 1];
        return !last || last.role === 'user';
    }, [isResponding, normalizedMessages]);

    const createMarkdownComponents = useCallback((messageId: string) => {
        if (!onOpenTableArtifact) return {};

        return {
            table: ({ children, ...props }: React.ComponentPropsWithoutRef<'table'> & { children?: ReactNode }) => {
                const parsed = children ? parseTableFromChildren(children) : null;

                const handleOpen = () => {
                    if (!parsed) return;
                    tableCounterRef.current += 1;
                    const syntheticArtifact: AIMessageArtifact = {
                        id: `md-table:${messageId}:${tableCounterRef.current}`,
                        messageId,
                        kind: 'table',
                        title: 'Table',
                        payload: { columns: parsed.columns, rows: parsed.rows }
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
    }, [onOpenTableArtifact]);

    const renderPromptStarter = () => (
        <Container className='d-flex flex-center flex-1 ai-thread-starter'>
            <Container className='d-flex column items-center gap-2 ai-thread-starter-content'>
                <Paragraph className='font-size-6 font-weight-5 color-primary ai-thread-starter-title'>
                    Ready when you are.
                </Paragraph>

                {starterInput ? (
                    <Container className='ai-thread-starter-input'>
                        {starterInput}
                    </Container>
                ) : null}

            </Container>
        </Container>
    );

    if (!conversationId) {
        return renderPromptStarter();
    }

    if (error) {
        return (
            <Container className='d-flex flex-center flex-1 ai-thread-empty'>
                <EmptyState
                    title='Failed to load conversation'
                    description={error}
                    buttonText={onRetry ? 'Retry' : undefined}
                    buttonOnClick={onRetry}
                />
            </Container>
        );
    }

    return (
        <AutoScrollList
            items={normalizedMessages}
            isLoading={isLoading}
            className='ai-thread-list'
            getItemKey={(message) => message.id}
            autoScrollDependency={showStandaloneTyping ? 'typing' : streamCursor}
            autoScrollDependencyEnabled={isResponding || showStandaloneTyping}
            renderLoading={Array.from({ length: 4 }).map((_, index) => (
                <Container key={index} className='ai-message-skeleton' />
            ))}
            renderEmpty={renderPromptStarter()}
            renderAfter={showStandaloneTyping ? (
                <Container className='d-flex column gap-025 ai-message-row is-assistant'>
                    <Container className='ai-message-bubble is-assistant ai-thinking-bubble'>
                        <Container className='d-flex items-center gap-025 ai-thinking-indicator' aria-label='Assistant is thinking'>
                            <span className='ai-thinking-dot' />
                            <span className='ai-thinking-dot' />
                            <span className='ai-thinking-dot' />
                        </Container>
                    </Container>
                </Container>
            ) : null}
            renderItem={(message) => {
                const isUser = message.role === 'user';
                const bubbleVariant = isUser ? 'is-user' : 'is-assistant';
                const mdComponents = !isUser
                    ? createMarkdownComponents(message.id)
                    : {};

                return (
                    <Container
                        className={`d-flex column gap-025 ai-message-row ${bubbleVariant}`}
                    >
                        {!isUser && Boolean(message.reasoning) && (
                            <Container className='ai-message-reasoning'>
                                <Paragraph className='font-size-1 text-uppercase color-muted ai-message-reasoning-label'>
                                    Thinking
                                </Paragraph>
                                <Container className='font-size-1 ai-message-text ai-message-markdown'>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {message.reasoning}
                                    </ReactMarkdown>
                                </Container>
                            </Container>
                        )}

                        {Boolean(message.preview) && (
                            <Container className={`ai-message-bubble ${bubbleVariant}`}>
                                <Container className='font-size-2-5 ai-message-text ai-message-markdown'>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                                        {message.preview}
                                    </ReactMarkdown>
                                </Container>
                            </Container>
                        )}

                        {!isUser && !message.preview && !message.reasoning && message.artifacts.length === 0 && (
                            <Container className='ai-message-bubble is-assistant ai-thinking-bubble'>
                                <Container className='d-flex items-center gap-025 ai-thinking-indicator' aria-label='Assistant is thinking'>
                                    <span className='ai-thinking-dot' />
                                    <span className='ai-thinking-dot' />
                                    <span className='ai-thinking-dot' />
                                </Container>
                            </Container>
                        )}

                        {message.artifacts.length > 0 && (
                            <Container className='d-flex column gap-05 ai-message-artifact-list'>
                                {message.artifacts.map((artifact) => {
                                    if (artifact.kind !== 'table') {
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

                                    return (
                                        <Container
                                            key={artifact.id}
                                            className={`d-flex column gap-05 ai-table-artifact-card ${
                                                isActive ? 'is-active' : ''
                                            }`}
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
                                                        onClick={() => onOpenTableArtifact(artifact)}
                                                    />
                                                </Container>
                                            )}
                                        </Container>
                                    );
                                })}
                            </Container>
                        )}

                        {message.toolInvocations.length > 0 && (
                            <Container className='d-flex column gap-05 ai-action-request-list'>
                                {message.toolInvocations.map((toolInvocation) => {
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

                                    return (
                                        <Container key={toolCallId} className={`ai-action-request-card ${statusClass}`}>
                                            <Container className='d-flex items-center gap-05 ai-action-request-header'>
                                                <span className='ai-action-request-dot' />
                                                <Paragraph className='font-size-1 color-muted'>
                                                    {toolInvocation.toolName === 'navigate_to' ? 'Navigation requested' :
                                                     toolInvocation.toolName === 'open_trajectory' ? 'Trajectory open requested' :
                                                     isApprovalFlow ? 'AI requested action for tool: ' : 'AI used tool: '}
                                                     {toolInvocation.toolName}
                                                </Paragraph>
                                            </Container>

                                            {isApprovalRequested && addToolApprovalResponse && (
                                                <Container className='d-flex items-center gap-025 ai-action-request-controls'>
                                                    <button
                                                        type='button'
                                                        className='ai-action-request-btn is-approve'
                                                        onClick={() => {
                                                            addToolApprovalResponse({
                                                                id: approvalResponseId,
                                                                approved: true
                                                            });

                                                            if (approvalResponseId !== toolCallId) {
                                                                addToolApprovalResponse({
                                                                    id: toolCallId,
                                                                    approved: true
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        type='button'
                                                        className='ai-action-request-btn is-reject'
                                                        onClick={() => {
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
                                                        }}
                                                    >
                                                        Reject
                                                    </button>
                                                </Container>
                                            )}

                                            {isExecuting && (
                                                <Container className='d-flex items-center gap-025 ai-action-request-controls'>
                                                    <Paragraph className='font-size-1 color-muted'>
                                                        Running{'\u2026'}
                                                    </Paragraph>
                                                </Container>
                                            )}
                                        </Container>
                                    );
                                })}
                            </Container>
                        )}
                    </Container>
                );
            }}
        />
    );
};

export default AIConversationThread;
