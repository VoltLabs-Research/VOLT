import { createUIMessageStream, isStepCount, streamText, toUIMessageStream } from 'ai';
import type { ToolSet } from 'ai';
import AIConversation from '@modules/ai/models/AIConversation';
import type AIMessage from '@modules/ai/models/AIMessage';
import chatCompactionService, { untrustedIn } from '@modules/ai/services/chat/ChatCompactionService';
import chatMessageService from '@modules/ai/services/chat/ChatMessageService';
import { openCards, preferSettledTools, uiMessageOf, wireMessageOf } from '@modules/ai/services/chat/message-parts';
import { toModelMessages } from '@modules/ai/services/chat/prompt-messages';
import { stampReasoning } from '@modules/ai/services/chat/stamp-reasoning';
import toolRegistry from '@modules/ai/services/tools/ToolRegistry';
import { SYSTEM_PROMPT } from '@modules/ai/contracts/system-prompt';
import type { ChatFrame, ChatHistory, ChatToolContext, OpenCard } from '@modules/ai/contracts/chat';
import type { ResolvedModel } from '@modules/ai/contracts/provider';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import type { ChatMessagePart, ChatUIMessage } from '@volt/contracts/modules/ai/chat';
import { generateEntityId } from '@shared/persistence/entity-id';
import logger from '@shared/logger';

// A safety net against a loop that never ends, far above what an analysis needs.
const MAX_STEPS = 48;

export const TURN_FAILED = 'Volt AI hit a problem and stopped. Try again.';

const CUT_SHORT = 'The previous model call stopped because it ran out of output room, not because the work was finished. Continue from exactly where you left off: do not repeat what you already said and do not wait for the user.';

export interface TurnOptions {
    context: ChatToolContext;
    conversation: AIConversation;
    resolved: ResolvedModel;
    permissions: readonly string[];
    history: ChatHistory;
    note?: string;
    signal: AbortSignal;
}

const describe = (error: unknown): string => error instanceof Error ? error.message : String(error);

async function* chunksOf<T>(stream: ReadableStream<T>): AsyncGenerator<T> {
    const reader = stream.getReader();
    try {
        for (;;) {
            const next = await reader.read();
            if (next.done) return;
            yield next.value;
        }
    } finally {
        reader.releaseLock();
    }
}

const kept = (part: ChatMessagePart): ChatMessagePart[] => {
    if (part.type !== 'text' && part.type !== 'reasoning') return [part];

    const text = part.text.trim();
    return text === ''
        ? []
        : [{
            ...part,
            text,
            state: 'done'
        }];
};

class ChatTurnEngine {
    async *turn(options: TurnOptions): AsyncIterable<ChatFrame> {
        const { context, conversation, resolved, permissions, signal } = options;
        const { tools, approvals } = toolRegistry.offered(permissions, context);
        const failed = (error: unknown): string => {
            logger.error(`@ai-chat: turn of conversation ${conversation.id} failed: ${describe(error)}`);
            return TURN_FAILED;
        };

        let history = await chatCompactionService.fitted(conversation, options.history, resolved.model);
        let note = options.note;
        const answer: { message: AIMessage | null } = { message: null };
        let spoken = 0;
        let opening = true;
        let closed = false;

        for (;;) {
            const cards = openCards(history.messages);
            const result = streamText({
                model: resolved.model,
                instructions: this.#instructions(cards, history.summary, note),
                messages: await toModelMessages(history.messages, tools),
                tools,
                activeTools: this.#activeTools(tools, cards),
                toolApproval: approvals,
                stopWhen: isStepCount(MAX_STEPS),
                abortSignal: signal,
                prepareStep: async ({ responseMessages }) => {
                    const latest = await AIConversation.findOneBy({ id: conversation.id });
                    if (latest === null || latest.summary === history.summary) return {};

                    history = await chatCompactionService.load(latest);

                    return {
                        messages: [...await toModelMessages(history.messages, tools), ...responseMessages],
                        instructions: this.#instructions(cards, history.summary, note)
                    };
                }
            });

            const stored = answer.message;
            const last = history.messages[history.messages.length - 1];
            const prior = stored === null || last?.id === stored.id ? history.messages : [...history.messages, uiMessageOf(stored)];
            const stream = createUIMessageStream<ChatUIMessage>({
                originalMessages: prior,
                generateId: generateEntityId,
                onError: failed,
                execute: ({ writer }) => {
                    writer.merge(toUIMessageStream<ToolSet, ChatUIMessage>({
                        stream: stampReasoning(result.stream),
                        tools,
                        sendStart: opening,
                        sendFinish: false,
                        onError: failed
                    }));
                },
                onEnd: async ({ responseMessage, isContinuation }) => {
                    answer.message = await this.#persist(conversation.id, responseMessage, isContinuation);
                }
            });

            for await (const chunk of chunksOf(stream)) {
                if (chunk.type === 'finish') continue;
                closed ||= chunk.type === 'abort';
                yield {
                    type: 'chunk',
                    chunk
                };
            }

            const grown = (answer.message?.parts.length ?? 0) > spoken;
            spoken = answer.message?.parts.length ?? spoken;
            const cutShort = await result.finishReason === 'length' && grown && !closed && !signal.aborted;
            if (!cutShort) break;

            opening = false;
            history = await chatCompactionService.load(conversation);
            note = [options.note, CUT_SHORT].filter((piece): piece is string => piece !== undefined).join(' ');
        }

        if (!closed) {
            yield {
                type: 'chunk',
                chunk: { type: 'finish' }
            };
        }

        if (answer.message !== null) {
            yield {
                type: 'saved',
                message: wireMessageOf(answer.message)
            };
        }
    }

    async #persist(conversationId: string, message: ChatUIMessage, isContinuation: boolean): Promise<AIMessage | null> {
        const stored = isContinuation ? await chatMessageService.find(conversationId, message.id) : null;
        const parts = preferSettledTools(message.parts, stored?.parts ?? [], kept);
        if (!parts.some((part) => part.type !== 'step-start')) return stored;

        if (stored !== null) return chatMessageService.replaceParts(stored, parts);

        return chatMessageService.create(conversationId, {
            id: message.id,
            role: AIMessageRole.Assistant,
            parts
        });
    }

    #instructions(cards: OpenCard[], summary: string | null, note: string | undefined): string {
        const parts = [SYSTEM_PROMPT];

        if (summary !== null) {
            parts.push(`The conversation is longer than what you can see: the earlier part was folded into this summary, and it is the only record of it you have. ${untrustedIn('summary', summary)}`);
        }

        if (cards.length > 0) {
            parts.push([
                'A card is already on screen waiting for the user to approve or reject it, so the tool behind it has not run yet and is not offered to you this turn:',
                `${cards.map((card) => `${card.toolName} with ${JSON.stringify(card.input)}`).join('; ')}.`,
                'Answer what they actually asked instead. If they want something different, tell them to reject the open card first.'
            ].join(' '));
        }

        if (note !== undefined) parts.push(note);

        return parts.join('\n\n');
    }

    #activeTools(tools: ToolSet, cards: OpenCard[]): string[] | undefined {
        if (cards.length === 0) return undefined;

        const held = new Set(cards.map((card) => card.toolName));

        return Object.keys(tools).filter((name) => !held.has(name));
    }
}

export default new ChatTurnEngine();
