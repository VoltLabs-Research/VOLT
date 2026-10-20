import { getToolName, isReasoningUIPart, isTextUIPart, isToolUIPart } from 'ai';
import type { ToolUIPart, UIMessage } from 'ai';

export interface ToolInvocation {
    toolCallId: string;
    approvalId?: string;
    toolName: string;
    state: ToolUIPart['state'];
    result: unknown;
}

interface TextSegment {
    type: 'text';
    content: string;
}

interface ReasoningSegment {
    type: 'reasoning';
    content: string;
}

interface ToolSegment {
    type: 'tool';
    invocation: ToolInvocation;
}

type MessageSegment = TextSegment | ReasoningSegment | ToolSegment;

export interface NormalizedConversationMessage extends UIMessage {
    segments: MessageSegment[];
    preview: string;
    reasoning: string;
}

const toSegments = (message: UIMessage): MessageSegment[] => {
    const segments: MessageSegment[] = [];

    message.parts.forEach((part, index) => {
        const last = segments[segments.length - 1];

        if (isTextUIPart(part)) {
            if (!part.text.trim()) return;

            if (last?.type === 'text') {
                last.content += `\n${part.text}`;
                return;
            }

            segments.push({
                type: 'text',
                content: part.text
            });
            return;
        }

        if (isReasoningUIPart(part)) {
            if (last?.type === 'reasoning') {
                last.content += part.text;
                return;
            }

            segments.push({
                type: 'reasoning',
                content: part.text
            });
            return;
        }

        if (isToolUIPart(part)) {
            const approvalId = part.approval?.id;

            segments.push({
                type: 'tool',
                invocation: {
                    toolCallId: part.toolCallId || approvalId || `tool-call-${index}`,
                    approvalId,
                    toolName: getToolName(part) || 'tool',
                    state: part.state,
                    result: part.output
                }
            });
        }
    });

    return segments;
};

export const groupAssistantRuns = (messages: UIMessage[]): UIMessage[][] => {
    const groups: UIMessage[][] = [];

    for (const message of messages) {
        const last = groups[groups.length - 1];

        if (last && last[0].role === 'assistant' && message.role === 'assistant') {
            last.push(message);
        } else {
            groups.push([message]);
        }
    }

    return groups;
};

export const signMessageGroup = (group: UIMessage[]): string => {
    let signature = '';

    for (const message of group) {
        signature += `;;${message.id}`;

        for (const part of message.parts) {
            if (isTextUIPart(part) || isReasoningUIPart(part)) {
                signature += `|${part.type}:${part.text.length}`;
            } else if (isToolUIPart(part)) {
                signature += `|${part.type}:${part.state}`;
            } else {
                signature += `|${part.type}:`;
            }
        }
    }

    return signature;
};

export const normalizeMessageGroup = (group: UIMessage[]): NormalizedConversationMessage => {
    const segments = group.flatMap(toSegments);
    let preview = '';
    let reasoning = '';

    for (const segment of segments) {
        if (segment.type === 'text') {
            preview += preview ? `\n${segment.content}` : segment.content;
        } else if (segment.type === 'reasoning') {
            reasoning += segment.content;
        }
    }

    return {
        ...group[0],
        segments,
        preview,
        reasoning
    };
};
