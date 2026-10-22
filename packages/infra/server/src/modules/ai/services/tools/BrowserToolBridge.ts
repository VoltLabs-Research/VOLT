import typia from 'typia';
import { AI_CHAT_EVENTS } from '@volt/contracts/modules/ai/socket';
import type { BrowserToolInvocation, BrowserToolResult } from '@volt/contracts/modules/ai/socket';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import chatPresence from '@modules/ai/services/chat/ChatPresence';
import type { ChatToolContext } from '@modules/ai/contracts/chat';
import logger from '@shared/logger';

// Longer than the tab waits for the viewer to mount, so a slow load still answers before this gives up.
const INVOKE_TIMEOUT_MS = 45_000;

const MAX_RESULT_CHARS = 64_000;

const isBrowserToolResult = typia.createIs<BrowserToolResult>();

const NO_TAB: BrowserToolResult = {
    ok: false,
    summary: 'No VOLT tab has this conversation open, so nothing ran in the browser.',
    reason: 'browser_unavailable',
    hint: 'Tell the user the action needs the conversation open in VOLT, and carry on without it.'
};

const NO_ANSWER: BrowserToolResult = {
    ok: false,
    summary: 'The browser did not answer in time, so it is unknown whether the action ran.',
    reason: 'browser_timeout',
    hint: 'Check the current state (for example with get_viewer_state) before trying again.'
};

const MALFORMED: BrowserToolResult = {
    ok: false,
    summary: 'The browser answered with something that is not a tool result.',
    reason: 'browser_malformed'
};

const STOPPED: BrowserToolResult = {
    ok: false,
    summary: 'The turn was stopped before the browser answered.',
    reason: 'turn_stopped'
};

interface BrowserToolCall {
    toolCallId: string;
    toolName: string;
    input: unknown;
}

const whenAborted = (signal: AbortSignal | undefined): Promise<BrowserToolResult> => new Promise((resolve) => {
    if (signal === undefined) return;
    if (signal.aborted) {
        resolve(STOPPED);
        return;
    }

    signal.addEventListener('abort', () => resolve(STOPPED), { once: true });
});

class BrowserToolBridge {
    async invoke(context: ChatToolContext, call: BrowserToolCall, signal?: AbortSignal): Promise<BrowserToolResult> {
        const target = chatPresence.driverOf(context.conversationId, context.origin);
        if (target === null) return NO_TAB;

        const invocation: BrowserToolInvocation = {
            conversationId: context.conversationId,
            teamId: context.teamId,
            ...call
        };

        return Promise.race([this.#ask(target, invocation), whenAborted(signal)]);
    }

    async #ask(socketId: string, invocation: BrowserToolInvocation): Promise<BrowserToolResult> {
        try {
            const answer = await socketIOEmitter.emitWithAckToSocket(socketId, AI_CHAT_EVENTS.toolInvoke, invocation, INVOKE_TIMEOUT_MS);

            return this.#accepted(answer);
        } catch (error: unknown) {
            logger.warn(`@ai-browser-tools: ${invocation.toolName} got no answer from socket ${socketId}: ${error instanceof Error ? error.message : String(error)}`);
            return NO_ANSWER;
        }
    }

    #accepted(answer: unknown): BrowserToolResult {
        if (!isBrowserToolResult(answer)) return MALFORMED;
        if (JSON.stringify(answer).length <= MAX_RESULT_CHARS) return answer;

        return {
            ok: answer.ok,
            summary: answer.summary.slice(0, MAX_RESULT_CHARS),
            reason: answer.reason,
            hint: 'The browser answered with more data than fits here; only its summary was kept.'
        };
    }
}

export default new BrowserToolBridge();
