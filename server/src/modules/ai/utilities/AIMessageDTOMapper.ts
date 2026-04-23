import type { AIMessageDTO } from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import type AIMessage from '@modules/ai/domain/entities/AIMessage';
import type { AIMessageToolStep } from '@modules/ai/domain/entities/AIMessage';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { isRecord } from '@shared/infrastructure/utilities/type-guards';

const VALID_KINDS = new Set<string>(['table', 'chart', 'image', 'text']);

@Singleton()
export default class AIMessageDTOMapper {
    toDTO(message: AIMessage): AIMessageDTO {
        const { modelInfo } = message.props;
        const steps = modelInfo?.steps ?? [];
        const artifactItems = this.extractArtifacts(message._id, steps);

        return {
            _id: message._id,
            conversationId: message.props.conversationId,
            role: message.props.role,
            parts: message.props.parts,
            content: message.props.content,
            artifacts: artifactItems.length > 0
                ? {
                    items: artifactItems
                }
                : null,
            modelInfo: message.props.modelInfo,
            tokenUsage: message.props.tokenUsage,
            createdAt: message.props.createdAt,
            updatedAt: message.props.updatedAt
        };
    }

    private extractArtifacts(messageId: string, steps: AIMessageToolStep[]): Record<string, unknown>[] {
        const items: Record<string, unknown>[] = [];

        for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
            const step = steps[stepIndex];

            for (let resultIndex = 0; resultIndex < step.toolResults.length; resultIndex++) {
                const result = step.toolResults[resultIndex];
                if (!isRecord(result.output)) continue;

                const output = result.output;
                let payloadType = 'unknown';
                if (typeof output.payloadType === 'string') {
                    payloadType = output.payloadType;
                }
                const kind = VALID_KINDS.has(payloadType) ? payloadType : 'unknown';

                items.push({
                    id: `${messageId}:step-${stepIndex}:tool-result-${resultIndex}`,
                    messageId,
                    kind,
                    title: result.toolName,
                    summary: output.summary,
                    payload: output,
                    toolName: result.toolName
                });
            }
        }

        return items;
    }
};
