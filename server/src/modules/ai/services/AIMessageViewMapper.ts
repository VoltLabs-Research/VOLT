import type AIMessage from '@modules/ai/models/AIMessage';
import type { AIMessageToolStep } from '@modules/ai/contracts/ai-message';
import { AIMessageArtifactKind } from '@volt/contracts/modules/ai/domain';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';

/* Maps a persisted AI message row to its wire view, deriving renderable artifacts
   from the tool results recorded on each step. */

const ARTIFACT_KINDS = new Set<string>(Object.values(AIMessageArtifactKind));

const extractArtifacts = (messageId: string, steps: AIMessageToolStep[]): Record<string, unknown>[] => {
    const items: Record<string, unknown>[] = [];

    steps.forEach((step, stepIndex) => {
        step.toolResults.forEach((result, resultIndex) => {
            /* Tool outputs travel through the AI SDK as `unknown`. */
            if(!isRecord(result.output)) return;

            const output = result.output;
            const payloadType = output.payloadType;

            items.push({
                id: `${messageId}:step-${stepIndex}:tool-result-${resultIndex}`,
                messageId,
                kind: typeof payloadType === 'string' && ARTIFACT_KINDS.has(payloadType)
                    ? payloadType
                    : AIMessageArtifactKind.Unknown,
                title: result.toolName,
                summary: output.summary,
                payload: output,
                toolName: result.toolName
            });
        });
    });

    return items;
};

export const toAIMessageView = (message: AIMessage): Record<string, unknown> => {
    const items = extractArtifacts(message.id, message.modelInfo?.steps ?? []);

    return {
        ...message.toJSON(),
        artifacts: items.length > 0 ? { items } : null
    };
};
