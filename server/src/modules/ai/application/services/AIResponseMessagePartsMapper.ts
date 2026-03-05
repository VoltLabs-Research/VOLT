import type { UIMessage } from 'ai';
import { injectable } from 'tsyringe';

interface AIResponseMessagePartsMappingResult {
    parts: UIMessage['parts'];
    textContent: string;
}

const isObject = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    return !Array.isArray(value);
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!isObject(value)) {
        return null;
    }

    return value;
};

@injectable()
export default class AIResponseMessagePartsMapper {
    mapAssistantResponseParts(responseMessages: unknown[]): AIResponseMessagePartsMappingResult {
        const parts: UIMessage['parts'] = [];
        let textContent = '';

        for (const responseMsg of responseMessages) {
            if (!isObject(responseMsg) || !Array.isArray(responseMsg.content)) continue;

            for (const part of responseMsg.content) {
                if (!isObject(part)) continue;

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
                            const approvalId = typeof part.approvalId === 'string'
                                ? part.approvalId
                                : part.toolCallId;
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
                            } as UIMessage['parts'][number];
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

                            if (isObject(invocationRecord.approval) && typeof invocationRecord.approval.id === 'string') {
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
                            } as UIMessage['parts'][number];
                            parts.push(toolResultPart);
                        }
                        break;
                    }
                }
            }
        }

        return { parts, textContent };
    }
}
