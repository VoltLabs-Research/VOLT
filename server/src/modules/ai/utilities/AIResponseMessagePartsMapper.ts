import type { AIConversationMessageParts } from '@modules/ai/domain/contracts/AIConversationMessage';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { asRecord, isRecord } from '@shared/infrastructure/utilities/type-guards';

interface AIResponseMessagePartsMappingResult {
    parts: AIConversationMessageParts;
    textContent: string;
};

@Singleton()
export default class AIResponseMessagePartsMapper {
    /**
     * Merges new assistant response parts into an existing set of parts.
     *
     * Tool-result parts that match an existing tool-call (by type and toolCallId)
     * update the original in place. All other new parts are appended.
     *
     * @param existingParts - Parts already persisted on the assistant message.
     * @param newParts - Parts produced by the continuation response.
     * @returns A merged parts array (new reference — does not mutate the inputs).
     */
    mergeAssistantParts(
        existingParts: AIConversationMessageParts,
        newParts: AIConversationMessageParts
    ): AIConversationMessageParts {
        const merged: AIConversationMessageParts = existingParts.map((part) => ({ ...part }));

        for (const newPart of newParts) {
            const newRecord = asRecord(newPart);

            if (
                newRecord
                && typeof newRecord.toolCallId === 'string'
                && newRecord.state === 'output-available'
            ) {
                const matchIndex = merged.findIndex((existing) => {
                    const existingRecord = asRecord(existing);
                    return (
                        existingRecord
                        && existingRecord.type === newRecord.type
                        && existingRecord.toolCallId === newRecord.toolCallId
                    );
                });

                if (matchIndex !== -1) {
                    const target = asRecord(merged[matchIndex]);
                    if (target) {
                        target.output = newRecord.output;
                        target.state = 'output-available';

                        if (isRecord(target.approval) && typeof target.approval.id === 'string') {
                            target.approval = {
                                id: target.approval.id,
                                approved: true
                            };
                        }
                    }
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
    }

    mapAssistantResponseParts(responseMessages: unknown[]): AIResponseMessagePartsMappingResult {
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
                        const existingInvocation = parts.find(
                            (candidate) => {
                                const candidateRecord = asRecord(candidate);
                                if (!candidateRecord) return false;
                                return (
                                    candidateRecord.type === typedPartType
                                    && candidateRecord.toolCallId === part.toolCallId
                                );
                            }
                        );

                        const invocationRecord = asRecord(existingInvocation);
                        if (invocationRecord) {
                            invocationRecord.output = part.output;
                            invocationRecord.state = 'output-available';

                            if (isRecord(invocationRecord.approval) && typeof invocationRecord.approval.id === 'string') {
                                const approvalRecord = invocationRecord.approval;
                                if (approvalRecord.approved !== false) {
                                    invocationRecord.approval = {
                                        id: approvalRecord.id,
                                        approved: true
                                    };
                                }
                            }
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
    }
};
