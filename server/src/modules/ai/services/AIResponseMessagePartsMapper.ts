import type { AIMessagePart, AIMessageParts } from '@modules/ai/contracts/ai-message';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

interface AIResponseMessagePartsMappingResult {
    parts: AIMessageParts;
    textContent: string;
}

const findToolPart = (
    parts: AIMessageParts,
    type: string,
    toolCallId: string
): AIMessagePart | undefined => parts.find((candidate) => (
    candidate.type === type && candidate.toolCallId === toolCallId
));

const applyToolResult = (
    target: AIMessagePart,
    output: unknown,
    preserveDenial: boolean
): void => {
    target.output = output;
    target.state = 'output-available';

    if (isRecord(target.approval) && typeof target.approval.id === 'string') {
        const approval = target.approval;
        if (!preserveDenial || approval.approved !== false) {
            target.approval = {
                id: approval.id,
                approved: true
            };
        }
    }
};

export const mergeAssistantParts = (
    existingParts: AIMessageParts,
    newParts: AIMessageParts
): AIMessageParts => {
    const merged: AIMessageParts = existingParts.map((part) => ({ ...part }));

    for (const newPart of newParts) {
        if (
            typeof newPart.toolCallId === 'string'
            && newPart.state === 'output-available'
        ) {
            const target = findToolPart(merged, newPart.type, newPart.toolCallId);
            if (target) {
                applyToolResult(target, newPart.output, false);
                continue;
            }
        }

        if (newPart.type === 'text') {
            const isDuplicateText = merged.some((existing) => (
                existing.type === 'text' && existing.text === newPart.text
            ));
            if (isDuplicateText) continue;
        }

        merged.push(newPart);
    }

    return merged;
};

export const mapAssistantResponseParts = (responseMessages: unknown[]): AIResponseMessagePartsMappingResult => {
    const parts: AIMessageParts = [];
    let textContent = '';

    for (const responseMsg of responseMessages) {
        if (!isRecord(responseMsg) || !Array.isArray(responseMsg.content)) continue;

        for (const part of responseMsg.content) {
            if (!isRecord(part)) continue;

            if (typeof part.type !== 'string') continue;
            const partType = part.type;

            switch (partType) {
                case 'text':
                    if (typeof part.text === 'string' && part.text.trim()) {
                        parts.push({
                            type: 'text',
                            text: part.text
                        });
                        textContent += (textContent ? '\n' : '') + part.text;
                    }
                    break;

                case 'reasoning':
                    if (typeof part.text === 'string' && part.text.trim()) {
                        parts.push({
                            type: 'reasoning',
                            text: part.text
                        });
                    }
                    break;

                case 'tool-call': {
                    if (typeof part.toolName !== 'string' || typeof part.toolCallId !== 'string') {
                        break;
                    }
                    const approvalId = typeof part.approvalId === 'string' ? part.approvalId : part.toolCallId;
                    const toolCallPart = {
                        type: `tool-${part.toolName}`,
                        toolName: part.toolName,
                        toolCallId: part.toolCallId,
                        approvalId,
                        input: part.input ?? {},
                        state: 'approval-requested',
                        approval: {
                            id: approvalId
                        }
                    };
                    parts.push(toolCallPart);
                    break;
                }

                case 'tool-result': {
                    if (typeof part.toolName !== 'string' || typeof part.toolCallId !== 'string') {
                        break;
                    }
                    const typedPartType = `tool-${part.toolName}`;
                    const existingInvocation = findToolPart(parts, typedPartType, part.toolCallId);

                    if (existingInvocation) {
                        applyToolResult(existingInvocation, part.output, true);
                    } else {
                        const toolResultPart = {
                            type: typedPartType,
                            toolCallId: part.toolCallId,
                            toolName: part.toolName,
                            input: part.input ?? {},
                            output: part.output,
                            state: 'output-available'
                        };
                        parts.push(toolResultPart);
                    }
                    break;
                }
            }
        }
    }

    return {
        parts,
        textContent
    };
};
