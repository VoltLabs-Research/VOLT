import { convertToModelMessages } from 'ai';
import type { ModelMessage } from 'ai';
import type {
    AIConversationMessage,
    AIMessageToolStep
} from '@modules/ai/contracts/ai-message';

export const toModelMessages = (messages: AIConversationMessage[]): Promise<ModelMessage[]> => {
    return convertToModelMessages(
        messages.map(({ id: _id, ...message }) => message) as Parameters<typeof convertToModelMessages>[0],
        { ignoreIncompleteToolCalls: true }
    );
};

export const toToolSteps = (steps: readonly AIMessageToolStep[]): AIMessageToolStep[] => {
    return steps.map((step) => ({
        stepNumber: step.stepNumber,
        toolCalls: step.toolCalls.map(({ toolName, input }) => ({
            toolName,
            input
        })),
        toolResults: step.toolResults.map(({ toolName, input, output }) => ({
            toolName,
            input,
            output
        }))
    }));
};
