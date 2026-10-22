import chatMessageService from '@modules/ai/services/chat/ChatMessageService';
import { isAwaitingApproval, isToolPart, toolNameOf, wireMessageOf } from '@modules/ai/services/chat/message-parts';
import toolRegistry from '@modules/ai/services/tools/ToolRegistry';
import type { ChatFrame, ChatToolContext } from '@modules/ai/contracts/chat';
import type { ChatMessagePart } from '@volt/contracts/modules/ai/chat';
import type { ToolApprovalDecision } from '@volt/contracts/modules/ai/socket';

export const DECLINED_BY_USER = 'The user declined this, so it never ran.';

const errorTextOf = (error: unknown): string => error instanceof Error ? error.message : 'The tool failed.';

// The user's answer to a card is carried out here, by the server, on the input the card showed:
// the model's loop only ever sees the outcome, so a client cannot approve anything it was not shown.
class ChatApprovalService {
    async *decide(
        context: ChatToolContext,
        permissions: readonly string[],
        decisions: ToolApprovalDecision[],
        signal: AbortSignal
    ): AsyncGenerator<ChatFrame> {
        for (const decision of decisions) {
            const message = await chatMessageService.holding(context.conversationId, decision.approvalId);
            const parts: ChatMessagePart[] = [];
            for (const part of message.parts) {
                parts.push(await this.#settled(part, decision, context, permissions, signal));
            }

            const settled = await chatMessageService.replaceParts(message, parts);
            yield* this.#effects(settled.parts, decision.approvalId);
            yield {
                type: 'saved',
                message: wireMessageOf(settled)
            };
        }
    }

    async #settled(
        part: ChatMessagePart,
        decision: ToolApprovalDecision,
        context: ChatToolContext,
        permissions: readonly string[],
        signal: AbortSignal
    ): Promise<ChatMessagePart> {
        if (!isAwaitingApproval(part) || part.approval.id !== decision.approvalId) return part;

        if (!decision.approved) {
            return {
                ...part,
                state: 'output-denied',
                approval: {
                    id: decision.approvalId,
                    approved: false,
                    reason: DECLINED_BY_USER
                }
            } as ChatMessagePart;
        }

        const approval = {
            id: decision.approvalId,
            approved: true as const
        };

        try {
            const output = await toolRegistry.run(toolNameOf(part), context, permissions, part.input, part.toolCallId, signal);

            return {
                ...part,
                state: 'output-available',
                output,
                approval
            } as ChatMessagePart;
        } catch (error: unknown) {
            return {
                ...part,
                state: 'output-error',
                errorText: errorTextOf(error),
                approval
            } as ChatMessagePart;
        }
    }

    *#effects(parts: ChatMessagePart[], approvalId: string): Iterable<ChatFrame> {
        for (const part of parts) {
            if (!isToolPart(part) || part.approval?.id !== approvalId) continue;

            if (part.state === 'output-available') {
                yield {
                    type: 'chunk',
                    chunk: {
                        type: 'tool-output-available',
                        toolCallId: part.toolCallId,
                        output: part.output
                    }
                };
            }

            if (part.state === 'output-denied') {
                yield {
                    type: 'chunk',
                    chunk: {
                        type: 'tool-output-denied',
                        toolCallId: part.toolCallId
                    }
                };
            }

            if (part.state === 'output-error') {
                yield {
                    type: 'chunk',
                    chunk: {
                        type: 'tool-output-error',
                        toolCallId: part.toolCallId,
                        errorText: part.errorText
                    }
                };
            }
        }
    }
}

export default new ChatApprovalService();
