import AIConversation from '@modules/ai/models/AIConversation';
import conversationService from '@modules/ai/services/ConversationService';
import modelResolver from '@modules/ai/services/ModelResolver';
import chatApprovalService from '@modules/ai/services/chat/ChatApprovalService';
import chatCompactionService from '@modules/ai/services/chat/ChatCompactionService';
import chatMessageService from '@modules/ai/services/chat/ChatMessageService';
import chatTurnEngine from '@modules/ai/services/chat/ChatTurnEngine';
import { wireMessageOf } from '@modules/ai/services/chat/message-parts';
import type { ChatFrame, ChatToolContext } from '@modules/ai/contracts/chat';
import type { ResolvedModel } from '@modules/ai/contracts/provider';
import teamService from '@modules/team/services/TeamService';
import { AIMessageRole } from '@volt/contracts/modules/ai/domain';
import type { ChatUIMessageChunk } from '@volt/contracts/modules/ai/chat';
import type { ChatTurnPayload } from '@volt/contracts/modules/ai/socket';
import ApplicationError from '@shared/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { TeamAccess, TeamArea, canAccessTeamArea, type TeamRole } from '@volt/contracts/modules/team/access';

const APPROVED = 'The user just approved the card on screen, so the tool behind it has run and its result is the last thing in this conversation. Say what it means in a sentence or two and carry on with the work; never end the turn without saying anything.';

const DECLINED = 'The user just rejected the card on screen, so nothing ran. Say so in one sentence, without arguing for it, and ask what they would rather do.';

interface LiveTurn {
    controller: AbortController;
    chunks: ChatUIMessageChunk[];
}

export interface PreparedTurn {
    conversation: AIConversation;
    resolved: ResolvedModel;
    role: TeamRole;
    context: ChatToolContext;
    turn: LiveTurn;
}

// One turn at a time per conversation, detached from the socket that asked for it: a tab that
// leaves or reloads does not stop it, and a tab that joins while it runs is replayed what it said.
class ChatStreamService {
    #turns = new Map<string, LiveTurn>();

    // The role its owner holds in the conversation's team today, or null once they have left it.
    roleOf(conversation: AIConversation): Promise<TeamRole | null> {
        return teamService.roleOf(conversation.teamId, conversation.userId);
    }

    // Everything that can refuse a turn is checked here, so the caller answers before it starts.
    async prepare(userId: string, payload: ChatTurnPayload, origin: string): Promise<PreparedTurn> {
        const conversation = await conversationService.ownedBy(userId, payload.conversationId);
        const role = await this.roleOf(conversation);
        if (!role || !canAccessTeamArea(role, TeamArea.AIConversation, TeamAccess.Write)) {
            throw ApplicationError.forbidden(ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS, 'Talking to Volt AI needs the Member role or higher');
        }

        const choice = payload.model ?? (conversation.provider !== null && conversation.model !== null
            ? {
                provider: conversation.provider,
                model: conversation.model
            }
            : undefined);
        const resolved = await modelResolver.resolve(conversation.teamId, choice?.provider, choice?.model);

        if (this.#turns.has(conversation.id)) {
            throw ApplicationError.conflict(ErrorCodes.AI_TURN_IN_PROGRESS, 'Volt AI is still answering in this conversation');
        }

        const turn: LiveTurn = {
            controller: new AbortController(),
            chunks: []
        };
        this.#turns.set(conversation.id, turn);

        return {
            conversation,
            resolved,
            role,
            context: {
                teamId: conversation.teamId,
                userId,
                conversationId: conversation.id,
                origin
            },
            turn
        };
    }

    async *respond(prepared: PreparedTurn, payload: ChatTurnPayload): AsyncIterable<ChatFrame> {
        const { conversation, resolved, role, context, turn } = prepared;
        const { signal } = turn.controller;

        try {
            if (payload.model !== undefined) await conversationService.choose(conversation, payload.model);

            if (payload.message !== undefined) {
                const spoken = await chatMessageService.create(conversation.id, {
                    id: payload.message.id,
                    role: AIMessageRole.User,
                    parts: [{
                        type: 'text',
                        text: payload.message.text.trim()
                    }]
                });
                yield {
                    type: 'saved',
                    message: wireMessageOf(spoken)
                };
            }

            for await (const frame of chatApprovalService.decide(context, role, payload.approvals ?? [], signal)) {
                this.#remember(turn, frame);
                yield frame;
            }

            const fresh = await AIConversation.findOneByOrFail({ id: conversation.id });
            const frames = chatTurnEngine.turn({
                context,
                conversation: fresh,
                resolved,
                role,
                history: await chatCompactionService.load(fresh),
                note: this.#note(payload),
                signal
            });
            for await (const frame of frames) {
                this.#remember(turn, frame);
                yield frame;
            }
        } finally {
            this.#turns.delete(conversation.id);
        }
    }

    stop(conversationId: string): boolean {
        const turn = this.#turns.get(conversationId);
        if (turn === undefined) return false;

        turn.controller.abort();
        return true;
    }

    isLive(conversationId: string): boolean {
        return this.#turns.has(conversationId);
    }

    replay(conversationId: string): ChatUIMessageChunk[] {
        return [...this.#turns.get(conversationId)?.chunks ?? []];
    }

    #remember(turn: LiveTurn, frame: ChatFrame): void {
        if (frame.type === 'chunk') turn.chunks.push(frame.chunk);
    }

    #note(payload: ChatTurnPayload): string | undefined {
        const decisions = payload.approvals ?? [];
        if (decisions.length === 0) return undefined;

        return decisions.some((decision) => decision.approved) ? APPROVED : DECLINED;
    }
}

export default new ChatStreamService();
