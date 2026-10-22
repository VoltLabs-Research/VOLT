import { Chat } from '@ai-sdk/react';
import { isToolUIPart } from 'ai';
import type { ChatTransport } from 'ai';
import { create } from 'zustand';
import socketService from '@/modules/socket/services/socket-service';
import type { SocketAck } from '@/modules/socket/contracts/socket-service';
import { createEntityId, mergeMessages, toUIMessage } from '@/modules/ai/utils/transcript';
import { AI_CHAT_EVENTS } from '@volt/contracts/modules/ai/socket';
import type { ChatChunkFrame, ChatJoined, ChatSavedFrame, ChatTurnPayload, ToolApprovalDecision } from '@volt/contracts/modules/ai/socket';
import type { AIModelChoice } from '@volt/contracts/modules/ai/domain';
import type { AIConversationMessage, ChatUIMessage, ChatUIMessageChunk } from '@volt/contracts/modules/ai/chat';

export interface TurnBody {
    approvals?: ToolApprovalDecision[];
    model?: AIModelChoice;
    // Reads the live turn already in the inbox instead of asking for one.
    resume?: boolean;
}

interface ChatHubState {
    connected: boolean;
    joined: Record<string, boolean>;
    failures: Record<string, string>;
}

export const useChatHub = create<ChatHubState>(() => ({
    connected: socketService.isConnected(),
    joined: {},
    failures: {}
}));

type Sink = ReadableStreamDefaultController<ChatUIMessageChunk>;

// Chunks of one conversation's turn, held until the Chat reading them opens its stream.
interface Inbox {
    buffer: ChatUIMessageChunk[];
    sink: Sink | null;
}

type SavedListener = (message: AIConversationMessage) => void;

const attached = new Map<string, number>();
const chats = new Map<string, Chat<ChatUIMessage>>();
const inboxes = new Map<string, Inbox>();
const live = new Set<string>();
// Conversations whose transcript has loaded: a live turn is only resumed on top of it, or the
// continued reply would stream over a copy that does not hold its earlier parts yet. A lost
// connection unsets it until the transcript is fetched again.
const ready = new Set<string>();
// Conversations joined since they were attached: joining one again is rejoining after a lost
// connection, which may have missed what the server stored meanwhile.
const joinedOnce = new Set<string>();
const savedListeners = new Set<SavedListener>();
const reconcilers = new Set<(conversationId: string) => void>();
let offs: Array<() => void> = [];

const setJoined = (conversationId: string, joined: boolean, failure?: string): void => {
    useChatHub.setState((state) => {
        const failures = { ...state.failures };
        if (failure === undefined) delete failures[conversationId];
        else failures[conversationId] = failure;

        return {
            joined: {
                ...state.joined,
                [conversationId]: joined
            },
            failures
        };
    });
};

const inboxOf = (conversationId: string): Inbox => {
    const standing = inboxes.get(conversationId);
    if (standing !== undefined) return standing;

    const inbox: Inbox = {
        buffer: [],
        sink: null
    };
    inboxes.set(conversationId, inbox);

    return inbox;
};

const settle = (conversationId: string): void => {
    inboxes.get(conversationId)?.sink?.close();
    inboxes.delete(conversationId);
};

const opened = (conversationId: string): ReadableStream<ChatUIMessageChunk> => new ReadableStream<ChatUIMessageChunk>({
    start(controller) {
        const inbox = inboxOf(conversationId);
        for (const chunk of inbox.buffer) controller.enqueue(chunk);
        inbox.buffer = [];
        inbox.sink = controller;
    },
    cancel() {
        const inbox = inboxes.get(conversationId);
        if (inbox !== undefined) inbox.sink = null;
    }
});

// Reads a turn this tab did not ask for: one live when it joined, or one another tab started. A
// turn that continues the reply on screen, as an approved card's does, is read on top of that
// reply; the SDK's own resume starts from an empty one, and the parts stored before the approval
// would vanish under the stream until it ends.
const resume = (conversationId: string): void => {
    const chat = chats.get(conversationId);
    const inbox = inboxes.get(conversationId);
    if (chat === undefined || !ready.has(conversationId) || (inbox !== undefined && inbox.sink !== null)) return;

    // Only a stored reply is continued: one on screen but not stored yet is this very turn, cut
    // off, which the replay rebuilds from its start.
    const opening = inbox?.buffer.find((chunk) => chunk.type === 'start');
    const last = chat.messages[chat.messages.length - 1];
    const continues = last?.role === 'assistant'
        && last.metadata?.position !== undefined
        && (opening?.type !== 'start' || opening.messageId === undefined || opening.messageId === last.id);

    if (continues) void chat.sendMessage(undefined, { body: { resume: true } satisfies TurnBody });
    else void chat.resumeStream();
};

const deliver = (conversationId: string, chunk: ChatUIMessageChunk): void => {
    const inbox = inboxOf(conversationId);

    if (inbox.sink !== null) {
        inbox.sink.enqueue(chunk);
    } else {
        inbox.buffer.push(chunk);
        if (chunk.type === 'start') resume(conversationId);
    }

    if (chunk.type === 'finish' || chunk.type === 'abort') settle(conversationId);
};

const interrupt = (conversationId: string, chunk: ChatUIMessageChunk): boolean => {
    const inbox = inboxes.get(conversationId);
    if (inbox === undefined || inbox.sink === null) return false;

    inbox.sink.enqueue(chunk);
    settle(conversationId);

    return true;
};

const failureOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

const SETTLING_CHUNKS = new Set<ChatUIMessageChunk['type']>([
    'tool-output-available',
    'tool-output-error',
    'tool-output-denied',
    'tool-approval-request'
]);

const toolCallOf = (chunk: ChatUIMessageChunk): string | null => 'toolCallId' in chunk ? chunk.toolCallId : null;

// A card answered in an earlier message settles a tool the streaming reply does not hold, and the
// Chat fails the whole stream on it. That message's stored copy arrives as a saved frame instead.
const ownToolsOnly = (held: ChatUIMessage | undefined): TransformStream<ChatUIMessageChunk, ChatUIMessageChunk> => {
    const known = new Set(held?.role === 'assistant'
        ? held.parts.flatMap((part) => (isToolUIPart(part) ? [part.toolCallId] : []))
        : []);

    return new TransformStream({
        transform(chunk, controller) {
            const toolCallId = toolCallOf(chunk);
            if (toolCallId !== null) {
                if (chunk.type === 'tool-input-start' || chunk.type === 'tool-input-available' || chunk.type === 'tool-input-error') {
                    known.add(toolCallId);
                } else if (SETTLING_CHUNKS.has(chunk.type) && !known.has(toolCallId)) {
                    return;
                }
            }

            controller.enqueue(chunk);
        }
    });
};

const lastOf = (messages: ChatUIMessage[] | undefined): ChatUIMessage | undefined => messages?.[messages.length - 1];

const payloadOf = (
    conversationId: string,
    messages: ChatUIMessage[],
    trigger: string,
    body: TurnBody | undefined
): ChatTurnPayload => {
    const last = messages[messages.length - 1];
    const text = last?.role === 'user' && trigger === 'submit-message' && body?.approvals === undefined
        ? last.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('\n').trim()
        : '';

    return {
        conversationId,
        ...text === '' || last === undefined
            ? {}
            : {
                message: {
                    id: last.id,
                    text
                }
            },
        ...body?.approvals === undefined ? {} : { approvals: body.approvals },
        ...body?.model === undefined ? {} : { model: body.model }
    };
};

const transportFor = (conversationId: string): ChatTransport<ChatUIMessage> => ({
    sendMessages: async ({ messages, trigger, body }) => {
        if ((body as TurnBody | undefined)?.resume === true) {
            live.delete(conversationId);
            return opened(conversationId).pipeThrough(ownToolsOnly(lastOf(messages)));
        }

        inboxes.delete(conversationId);
        const stream = opened(conversationId).pipeThrough(ownToolsOnly(lastOf(messages)));

        try {
            const ack = await socketService.emit<SocketAck>(AI_CHAT_EVENTS.send, payloadOf(conversationId, messages, trigger, body as TurnBody | undefined));
            if (!ack.ok) {
                interrupt(conversationId, {
                    type: 'error',
                    errorText: ack.error ?? 'Internal::Server::Error'
                });
            }
        } catch (error: unknown) {
            interrupt(conversationId, {
                type: 'error',
                errorText: failureOf(error)
            });
        }

        return stream;
    },
    reconnectToStream: async () => {
        const inbox = inboxes.get(conversationId);
        const isLive = live.delete(conversationId);
        if (inbox !== undefined && inbox.sink !== null) return null;
        if (!isLive && (inbox === undefined || inbox.buffer.length === 0)) return null;

        return opened(conversationId).pipeThrough(ownToolsOnly(lastOf(chats.get(conversationId)?.messages)));
    }
});

// A tab that rejoins may have missed what the server stored while it was away, the reply it was
// reading among it: the transcript is fetched again, and a live turn resumes on top of that.
const reconcile = (conversationId: string): void => {
    for (const listener of reconcilers) listener(conversationId);
};

const join = async (conversationId: string): Promise<void> => {
    if (!socketService.canReach(AI_CHAT_EVENTS.join)) return;

    try {
        const ack = await socketService.emit<SocketAck<ChatJoined>>(AI_CHAT_EVENTS.join, { conversationId });
        if (!attached.has(conversationId)) return;

        if (!ack.ok || ack.data === undefined) {
            setJoined(conversationId, false, ack.error ?? 'Internal::Server::Error');
            return;
        }

        setJoined(conversationId, true);
        if (joinedOnce.has(conversationId)) reconcile(conversationId);
        joinedOnce.add(conversationId);

        if (!ack.data.live) return;

        live.add(conversationId);
        resume(conversationId);
    } catch (error: unknown) {
        if (attached.has(conversationId)) setJoined(conversationId, false, failureOf(error));
    }
};

const onConnection = (connected: boolean): void => {
    useChatHub.setState({ connected });

    if (!connected) {
        live.clear();
        ready.clear();
        useChatHub.setState({ joined: {} });
        for (const conversationId of [...inboxes.keys()]) {
            interrupt(conversationId, {
                type: 'abort',
                reason: 'disconnected'
            });
        }
        return;
    }

    for (const conversationId of attached.keys()) void join(conversationId);
};

const onChunk = (frame: ChatChunkFrame): void => {
    if (!attached.has(frame.conversationId)) return;

    deliver(frame.conversationId, frame.chunk);
};

const onSaved = (frame: ChatSavedFrame): void => {
    const chat = chats.get(frame.conversationId);
    if (chat !== undefined) chat.messages = mergeMessages(chat.messages, [toUIMessage(frame.message)]);

    for (const listener of savedListeners) listener(frame.message);
};

const listen = (): void => {
    if (offs.length > 0) return;

    offs = [
        socketService.onConnectionChange(onConnection),
        socketService.on<[ChatChunkFrame]>(AI_CHAT_EVENTS.chunk, onChunk),
        socketService.on<[ChatSavedFrame]>(AI_CHAT_EVENTS.saved, onSaved)
    ];
    useChatHub.setState({ connected: socketService.isConnected() });
};

const unlisten = (): void => {
    if (attached.size > 0) return;

    offs.forEach((off) => off());
    offs = [];
};

export const chatHub = {
    // Kept after the last holder leaves, so a remount (or React's strict double mount) finds the
    // instance it already holds instead of one the hub no longer knows.
    chatFor(conversationId: string): Chat<ChatUIMessage> {
        const standing = chats.get(conversationId);
        if (standing !== undefined) return standing;

        const chat = new Chat<ChatUIMessage>({
            id: conversationId,
            transport: transportFor(conversationId),
            generateId: createEntityId
        });
        chats.set(conversationId, chat);

        return chat;
    },

    // Refcounted: the floating panel and the AI page can show the same conversation at once.
    attach(conversationId: string): () => void {
        const holders = attached.get(conversationId) ?? 0;
        attached.set(conversationId, holders + 1);

        listen();
        if (holders === 0) {
            socketService.connect().catch(() => undefined);
            void join(conversationId);
        }

        return () => {
            const left = (attached.get(conversationId) ?? 1) - 1;
            if (left > 0) {
                attached.set(conversationId, left);
                return;
            }

            attached.delete(conversationId);
            interrupt(conversationId, {
                type: 'abort',
                reason: 'left'
            });
            inboxes.delete(conversationId);
            live.delete(conversationId);
            ready.delete(conversationId);
            joinedOnce.delete(conversationId);
            socketService.emitWithoutAck(AI_CHAT_EVENTS.leave, { conversationId });
            useChatHub.setState((state) => {
                const joined = { ...state.joined };
                delete joined[conversationId];
                return { joined };
            });
            unlisten();
        };
    },

    // The turn runs on the server whichever tab asked for it: stopping it is asking the server.
    stop(conversationId: string): void {
        socketService.emitWithoutAck(AI_CHAT_EVENTS.stop, { conversationId });
    },

    // The transcript has loaded what came before: resume the turn the join reported live, or
    // the one whose chunks arrived meanwhile.
    ready(conversationId: string): void {
        if (!attached.has(conversationId) || ready.has(conversationId)) return;

        ready.add(conversationId);
        const inbox = inboxes.get(conversationId);
        if (live.has(conversationId) || (inbox !== undefined && inbox.sink === null && inbox.buffer.length > 0)) {
            resume(conversationId);
        }
    },

    onSaved(listener: SavedListener): () => void {
        savedListeners.add(listener);
        return () => {
            savedListeners.delete(listener);
        };
    },

    onReconcile(listener: (conversationId: string) => void): () => void {
        reconcilers.add(listener);
        return () => {
            reconcilers.delete(listener);
        };
    }
};
