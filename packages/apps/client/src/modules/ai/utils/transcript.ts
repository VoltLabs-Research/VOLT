import { isToolUIPart } from 'ai';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import type { AIConversationMessage, ChatMessagePart, ChatUIMessage } from '@volt/contracts/modules/ai/chat';

const UNSTORED = Number.MAX_SAFE_INTEGER;

export const toUIMessage = (message: AIConversationMessage): ChatUIMessage => ({
    id: message._id,
    role: message.role === AIMessageRole.Assistant ? 'assistant' : 'user',
    parts: message.parts,
    metadata: {
        createdAt: message.createdAt,
        position: message.position
    }
});

// The same timestamp-first, 24 hex digit shape as the server's ids, so the server can keep the id
// a message was shown under and the stored copy replaces the optimistic one in place.
export const createEntityId = (): string => {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    new DataView(bytes.buffer).setUint32(0, Math.floor(Date.now() / 1000));

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const positionOf = (message: ChatUIMessage): number => message.metadata?.position ?? UNSTORED;

const isSettled = (part: ChatMessagePart): boolean => isToolUIPart(part) && (
    (part.state === 'output-available' && part.preliminary !== true)
    || part.state === 'output-error'
    || part.state === 'output-denied'
);

// A copy that arrives later can still be older than what is on screen: an approval settled by
// one stream while another still carried the open card. A settled tool never goes back to open.
const keepSettledTools = (current: ChatUIMessage, incoming: ChatUIMessage): ChatUIMessage => {
    const settled = new Map(current.parts.filter(isSettled).flatMap((part) => (isToolUIPart(part) ? [[part.toolCallId, part] as const] : [])));
    if (settled.size === 0) return incoming;

    return {
        ...incoming,
        parts: incoming.parts.map((part) => (isToolUIPart(part) && !isSettled(part) ? settled.get(part.toolCallId) ?? part : part))
    };
};

// Merges by id, the incoming copy winning, and orders by stored position. Messages the server has
// not stored yet keep their place at the end, in the order they appeared.
export const mergeMessages = (current: ChatUIMessage[], incoming: ChatUIMessage[]): ChatUIMessage[] => {
    const byId = new Map(current.map((message) => [message.id, message]));
    for (const message of incoming) {
        const held = byId.get(message.id);
        byId.set(message.id, held === undefined ? message : keepSettledTools(held, message));
    }

    return [...byId.values()].sort((left, right) => positionOf(left) - positionOf(right));
};

export const textOf = (message: ChatUIMessage): string => message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n')
    .trim();
