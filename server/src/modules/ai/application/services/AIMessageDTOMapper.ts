import { injectable } from 'tsyringe';
import type AIMessage from '@modules/ai/domain/entities/AIMessage';
import type { AIMessageDTO } from '@modules/ai/application/dtos/ListAIConversationMessagesDTO';
import type { AIMessageToolStep } from '@modules/ai/domain/entities/AIMessage';

const VALID_KINDS = new Set<string>(['table', 'chart', 'image', 'text']);

@injectable()
export default class AIMessageDTOMapper {
    toDTO(message: AIMessage): AIMessageDTO {
        const { modelInfo } = message.props;
        const steps = modelInfo?.steps ?? [];
        const artifactItems = this.extractArtifacts(message.id, steps);

        return {
            _id: message.id,
            conversationId: message.props.conversationId,
            role: message.props.role,
            parts: message.props.parts,
            content: message.props.content,
            artifacts: artifactItems.length > 0 ? { items: artifactItems } : null,
            modelInfo: message.props.modelInfo,
            tokenUsage: message.props.tokenUsage,
            createdAt: message.props.createdAt,
            updatedAt: message.props.updatedAt
        };
    }

    /**
     * Extracts display artifacts from tool result data stored in modelInfo.steps.
     * These artifacts drive rich UI rendering (tables, charts, images).
     */
    private extractArtifacts(messageId: string, steps: AIMessageToolStep[]): Record<string, unknown>[] {
        const items: Record<string, unknown>[] = [];

        for (let s = 0; s < steps.length; s++) {
            const step = steps[s];

            for (let i = 0; i < step.toolResults.length; i++) {
                const result = step.toolResults[i];
                if (!this.isRecord(result.output)) continue;

                const output = result.output;
                const payloadType = typeof output.payloadType === 'string'
                    ? output.payloadType
                    : 'unknown';
                const kind = VALID_KINDS.has(payloadType) ? payloadType : 'unknown';

                items.push({
                    id: `${messageId}:step-${s}:tool-result-${i}`,
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

    private isRecord(value: unknown): value is Record<string, unknown> {
        if (value === null || typeof value !== 'object') {
            return false;
        }

        return !Array.isArray(value);
    }
}
