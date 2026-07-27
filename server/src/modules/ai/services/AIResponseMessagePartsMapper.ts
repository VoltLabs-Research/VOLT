import type { AIConversationMessageParts } from '@modules/ai/models/AIMessageModel';
import { asRecord, isRecord } from '@shared/infrastructure/utilities/type-guards';

interface AIResponseMessagePartsMappingResult {
    parts: AIConversationMessageParts;
    textContent: string;
}

const findToolPart = (
    parts: AIConversationMessageParts,
    type: unknown,
    toolCallId: unknown
): Record<string, unknown> | undefined => {
    for (const candidate of parts) {
        const candidateRecord = asRecord(candidate);
        if (
            candidateRecord
            && candidateRecord.type === type
            && candidateRecord.toolCallId === toolCallId
        ) {
            return candidateRecord;
        }
    }

    return undefined;
};

const applyToolResult = (
    target: Record<string, unknown>,
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
    existingParts: AIConversationMessageParts,
    newParts: AIConversationMessageParts
): AIConversationMessageParts => {
    const merged: AIConversationMessageParts = existingParts.map((part) => ({ ...part }));

    for (const newPart of newParts) {
        const newRecord = asRecord(newPart);

        if (
            newRecord
            && typeof newRecord.toolCallId === 'string'
            && newRecord.state === 'output-available'
        ) {
            const target = findToolPart(merged, newRecord.type, newRecord.toolCallId);
            if (target) {
                applyToolResult(target, newRecord.output, false);
                continue;
            }
        }

        if (
            newRecord
            && newRecord.type === 'text'
            && typeof newRecord.text === 'string'
        ) {
            const isDuplicateText = merged.some((existing) => {
                const existingRecord = asRecord(existing);
                return (
                    existingRecord
                    && existingRecord.type === 'text'
                    && existingRecord.text === newRecord.text
                );
            });
            if (isDuplicateText) continue;
        }

        merged.push(newPart);
    }

    return merged;
};

export const mapAssistantResponseParts = (responseMessages: unknown[]): AIResponseMessagePartsMappingResult => {
    const parts: AIConversationMessageParts = [];
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
                        parts.push({ type: 'text', text: part.text });
                        textContent += (textContent ? '\n' : '') + part.text;
                    }
                    break;

                case 'reasoning':
                    if (typeof part.text === 'string' && part.text.trim()) {
                        parts.push({ type: 'reasoning', text: part.text });
                    }
                    break;

                case 'tool-call':
                    if (typeof part.toolName !== 'string' || typeof part.toolCallId !== 'string') {
                        break;
                    }
                    {
                        let approvalId = part.toolCallId;
                        if (typeof part.approvalId === 'string') {
                            approvalId = part.approvalId;
                        }
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
                    }
                    break;

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
