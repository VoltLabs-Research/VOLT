import socketService from '@/modules/socket/services/socket-service';
import {
    APPROVED_CALL,
    CALLS_AFTER_APPROVAL,
    CALLS_BEFORE_APPROVAL,
    LANDING_ANSWER,
    LANDING_ANSWER_ID,
    LANDING_CONVERSATION_ID,
    landingAnswer,
    landingQuestion
} from '@/modules/marketing/utils/landing-conversation';
import { AI_CHAT_EVENTS } from '@volt/contracts/modules/ai/socket';
import type { LandingToolCall } from '@/modules/marketing/utils/landing-conversation';
import type { AIConversationMessage, ChatUIMessageChunk } from '@volt/contracts/modules/ai/chat';
import type { ChatJoinPayload, ChatTurnPayload } from '@volt/contracts/modules/ai/socket';

// Whoever asks for less motion sees the conversation as it ends, without watching it play.
export const PLAYS_CONVERSATION = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// How long the model takes to pick each tool and write its input, how long the server takes
// to run one, and the cluster to run the pipeline.
const CHOOSE_MS = 380;
const INPUT_MS = 220;
const RUN_MS = 560;
const PIPELINE_MS = 1900;
const WRITE_MS = 520;
const TOKEN_MS = 22;

// What the server sends the conversation's room, after its delay: a chunk of the turn it
// streams, or a message as it stored it.
type Beat =
    | { delayMs: number; chunk: ChatUIMessageChunk }
    | { delayMs: number; saved: AIConversationMessage };

const at = (delayMs: number, chunk: ChatUIMessageChunk): Beat => ({
    delayMs,
    chunk
});

const stored = (message: AIConversationMessage): Beat => ({
    delayMs: 0,
    saved: message
});

// A step of the answer in which the assistant calls one of the server's tools. The server
// runs it, or, for one that needs approval, asks for it and ends its answer there.
const callTool = (call: LandingToolCall): Beat[] => [
    at(0, { type: 'start-step' }),
    at(CHOOSE_MS, {
        type: 'tool-input-start',
        toolCallId: call.id,
        toolName: call.tool
    }),
    at(INPUT_MS, {
        type: 'tool-input-available',
        toolCallId: call.id,
        toolName: call.tool,
        input: call.input
    }),
    call.needsApproval
        ? at(0, {
            type: 'tool-approval-request',
            approvalId: call.id,
            toolCallId: call.id
        })
        : at(RUN_MS, {
            type: 'tool-output-available',
            toolCallId: call.id,
            output: call.output
        }),
    at(0, { type: 'finish-step' })
];

const writeAnswer = (): Beat[] => [
    at(0, { type: 'start-step' }),
    at(WRITE_MS, {
        type: 'text-start',
        id: 'landing-answer-text'
    }),
    ...(LANDING_ANSWER.match(/\S+\s*/g) ?? []).map((delta) => at(TOKEN_MS, {
        type: 'text-delta',
        id: 'landing-answer-text',
        delta
    })),
    at(0, {
        type: 'text-end',
        id: 'landing-answer-text'
    }),
    at(0, { type: 'finish-step' })
];

// Asked, the assistant calls tools up to the pipeline, which waits for the user's approval:
// the turn ends there, and the server keeps the answer with its card open.
const asked = (questionId: string): Beat[] => [
    stored(landingQuestion(questionId)),
    at(0, {
        type: 'start',
        messageId: LANDING_ANSWER_ID
    }),
    ...CALLS_BEFORE_APPROVAL.flatMap(callTool),
    at(0, { type: 'finish' }),
    stored(landingAnswer(false))
];

// Approved, the server runs the pipeline itself and the turn carries on in the same answer: it
// follows the analysis, reads its result and writes the answer.
const approved = (): Beat[] => [
    at(PIPELINE_MS, {
        type: 'tool-output-available',
        toolCallId: APPROVED_CALL.id,
        output: APPROVED_CALL.output
    }),
    at(0, {
        type: 'start',
        messageId: LANDING_ANSWER_ID
    }),
    ...CALLS_AFTER_APPROVAL.flatMap(callTool),
    ...writeAnswer(),
    at(0, { type: 'finish' }),
    stored(landingAnswer(true))
];

// The server's side of the conversation, over the socket the screen holds: it answers the app's
// join, send and stop as the server does, and sends the room what the server would.
export const serveConversation = (): (() => void) => {
    let timers: number[] = [];

    const cancel = () => {
        timers.forEach((timer) => window.clearTimeout(timer));
        timers = [];
    };

    const send = (beat: Beat) => {
        if ('chunk' in beat) {
            socketService.deliver(AI_CHAT_EVENTS.chunk, {
                conversationId: LANDING_CONVERSATION_ID,
                chunk: beat.chunk
            });
            return;
        }

        socketService.deliver(AI_CHAT_EVENTS.saved, {
            conversationId: LANDING_CONVERSATION_ID,
            message: beat.saved
        });
    };

    const play = (beats: Beat[]) => {
        cancel();
        let elapsedMs = 0;
        for (const beat of beats) {
            elapsedMs += beat.delayMs;
            timers.push(window.setTimeout(() => send(beat), elapsedMs));
        }
    };

    const stops = [
        socketService.answer(AI_CHAT_EVENTS.join, (payload) => ({
            ok: true,
            data: {
                conversationId: (payload as ChatJoinPayload).conversationId,
                live: false
            }
        })),
        socketService.answer(AI_CHAT_EVENTS.leave, () => ({ ok: true })),
        socketService.answer(AI_CHAT_EVENTS.stop, () => {
            cancel();
            send(at(0, { type: 'abort' }));
            return { ok: true };
        }),
        socketService.answer(AI_CHAT_EVENTS.send, (payload) => {
            const turn = payload as ChatTurnPayload;
            if (turn.conversationId !== LANDING_CONVERSATION_ID) {
                return {
                    ok: false,
                    error: 'AI::Conversation::NotFound'
                };
            }

            play((turn.approvals?.length ?? 0) > 0 ? approved() : asked(turn.message?.id ?? 'landing-message-ask'));
            return { ok: true };
        })
    ];

    return () => {
        cancel();
        stops.forEach((stop) => stop());
    };
};
