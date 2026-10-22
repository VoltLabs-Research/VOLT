import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai';
import type { DynamicToolUIPart, ToolUIPart } from 'ai';
import type { ChatMessagePart, ChatUIMessage } from '@volt/contracts/modules/ai/chat';

type ToolPart = ToolUIPart | DynamicToolUIPart;

export type ToolOutcome =
    | { kind: 'running' }
    | { kind: 'awaiting'; approvalId: string }
    | { kind: 'done'; output: unknown }
    | { kind: 'failed'; error: string }
    | { kind: 'declined' };

export interface ToolActivity {
    toolCallId: string;
    toolName: string;
    input: unknown;
    outcome: ToolOutcome;
}

export type WorkStep =
    | { kind: 'reasoning'; text: string; isStreaming: boolean; durationMs: number | null }
    | { kind: 'tool'; activity: ToolActivity };

export type MessageBlock =
    | { kind: 'text'; text: string; isStreaming: boolean }
    | { kind: 'work'; steps: WorkStep[] }
    | { kind: 'approvals'; activities: ToolActivity[] };

const outcomeOf = (part: ToolPart): ToolOutcome => {
    switch (part.state) {
        case 'approval-requested':
            return {
                kind: 'awaiting',
                approvalId: part.approval.id
            };
        case 'output-available':
            return part.preliminary === true
                ? { kind: 'running' }
                : {
                    kind: 'done',
                    output: part.output
                };
        case 'output-error':
            return {
                kind: 'failed',
                error: part.errorText
            };
        case 'output-denied':
            return { kind: 'declined' };
        default:
            return { kind: 'running' };
    }
};

const activityOf = (part: ToolPart): ToolActivity => ({
    toolCallId: part.toolCallId,
    toolName: getToolName(part),
    input: part.input,
    outcome: outcomeOf(part)
});

const durationOf = (part: ChatMessagePart): number | null => {
    if (part.type !== 'reasoning') return null;

    const durationMs = part.providerMetadata?.volt?.durationMs;
    return typeof durationMs === 'number' ? durationMs : null;
};

// Text the user reads, the work the assistant did to get there, and the cards that wait for the
// user: a tool that asked for approval is a card for good, whatever became of it.
export const blocksOf = (message: ChatUIMessage): MessageBlock[] => {
    const blocks: MessageBlock[] = [];
    const last = (): MessageBlock | undefined => blocks[blocks.length - 1];

    const addStep = (step: WorkStep): void => {
        const current = last();
        if (current?.kind === 'work') current.steps.push(step);
        else blocks.push({
            kind: 'work',
            steps: [step]
        });
    };

    for (const part of message.parts) {
        if (isTextUIPart(part)) {
            const isStreaming = part.state === 'streaming';
            const text = isStreaming ? part.text : part.text.trim();
            if (text === '') continue;

            const current = last();
            if (current?.kind === 'text') {
                current.text = `${current.text}\n\n${text}`;
                current.isStreaming ||= isStreaming;
            } else {
                blocks.push({
                    kind: 'text',
                    text,
                    isStreaming
                });
            }
            continue;
        }

        if (isReasoningUIPart(part)) {
            const text = part.text.trim();
            if (text === '' && part.state !== 'streaming') continue;

            addStep({
                kind: 'reasoning',
                text,
                isStreaming: part.state === 'streaming',
                durationMs: durationOf(part)
            });
            continue;
        }

        if (!isToolUIPart(part)) continue;

        const activity = activityOf(part);
        if (part.approval === undefined) {
            addStep({
                kind: 'tool',
                activity
            });
            continue;
        }

        const current = last();
        if (current?.kind === 'approvals') current.activities.push(activity);
        else blocks.push({
            kind: 'approvals',
            activities: [activity]
        });
    }

    return blocks;
};

export const isWorkLive = (steps: WorkStep[]): boolean => steps.some((step) => (
    step.kind === 'reasoning' ? step.isStreaming : step.activity.outcome.kind === 'running'
));
