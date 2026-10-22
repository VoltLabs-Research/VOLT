import { getToolName, isToolUIPart } from 'ai';
import type { DynamicToolUIPart, ToolUIPart } from 'ai';
import type { AIConversationMessage, ChatMessagePart, ChatUIMessage } from '@volt/contracts/modules/ai/chat';
import type AIMessage from '@modules/ai/models/AIMessage';
import type { OpenCard } from '@modules/ai/contracts/chat';

export type ChatToolPart = ToolUIPart | DynamicToolUIPart;

export const isToolPart = (part: ChatMessagePart): part is ChatToolPart => isToolUIPart(part);

export const toolNameOf = (part: ChatToolPart): string => getToolName(part);

export const isSettledTool = (part: ChatMessagePart): part is ChatToolPart =>
    isToolPart(part)
        && (part.state === 'output-available' || part.state === 'output-error' || part.state === 'output-denied');

export const isAwaitingApproval = (part: ChatMessagePart): part is ChatToolPart & { state: 'approval-requested' } =>
    isToolPart(part) && part.state === 'approval-requested';

// A continued answer arrives with the parts it already had. A tool settled since then, by an
// approval decided between the two streams, keeps its stored outcome over the stale copy.
export const preferSettledTools = (
    incoming: ChatMessagePart[],
    stored: ChatMessagePart[],
    keep: (part: ChatMessagePart) => ChatMessagePart[]
): ChatMessagePart[] => {
    const settled = new Map(stored.filter(isSettledTool).map((part) => [part.toolCallId, part]));

    return [
        ...incoming.flatMap((part) => {
            if (isToolPart(part)) {
                const held = settled.get(part.toolCallId);
                if (held !== undefined) {
                    settled.delete(part.toolCallId);
                    return [held];
                }
            }

            return keep(part);
        }),
        ...settled.values()
    ];
};

export const uiMessageOf = (message: AIMessage): ChatUIMessage => ({
    id: message.id,
    role: message.role as ChatUIMessage['role'],
    parts: message.parts,
    metadata: {
        createdAt: message.createdAt.toISOString(),
        position: message.position
    }
});

export const wireMessageOf = (message: AIMessage): AIConversationMessage => ({
    _id: message.id,
    conversationId: message.conversationId,
    position: message.position,
    role: message.role,
    parts: message.parts,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString()
});

export const openCards = (messages: ChatUIMessage[]): OpenCard[] =>
    messages.flatMap((message) => message.parts.flatMap((part) => (isAwaitingApproval(part)
        ? [{
            toolCallId: part.toolCallId,
            toolName: toolNameOf(part),
            input: part.input,
            approvalId: part.approval.id
        }]
        : [])));

export const textOf = (parts: ChatMessagePart[]): string =>
    parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n\n').trim();

export const readable = (output: unknown): string =>
    typeof output === 'string' ? output : JSON.stringify(output ?? null);
