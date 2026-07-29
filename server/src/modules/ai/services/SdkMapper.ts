import { convertToModelMessages } from 'ai';
import type { ModelMessage } from 'ai';
import type {
    AIConversationMessage,
    AIMessageToolCall,
    AIMessageToolResult,
    AIMessageToolStep
} from '@modules/ai/contracts/domain/ai-message';

interface SdkToolCall{
    toolName: string;
    input: unknown;
}

interface SdkToolResult extends SdkToolCall{
    output: unknown;
}

interface SdkStep{
    stepNumber: number;
    toolCalls: SdkToolCall[];
    toolResults: SdkToolResult[];
}

type ModelInputMessage = Omit<AIConversationMessage, 'id'>;

export default class SdkMapper{
    toModelMessages(messages: AIConversationMessage[]): Promise<ModelMessage[]>{
        const withoutIds: ModelInputMessage[] = messages.map(({ id: _id, ...message }) => message);

        return convertToModelMessages(
            withoutIds as Parameters<typeof convertToModelMessages>[0],
            { ignoreIncompleteToolCalls: true }
        );
    }

    toToolSteps(steps: readonly SdkStep[]): AIMessageToolStep[]{
        return steps.map((step) => ({
            stepNumber: step.stepNumber,
            toolCalls: step.toolCalls.map((toolCall) => this.#toToolCall(toolCall)),
            toolResults: step.toolResults.map((toolResult) => this.#toToolResult(toolResult))
        }));
    }

    #toToolCall(toolCall: SdkToolCall): AIMessageToolCall{
        return {
            toolName: toolCall.toolName,
            input: toolCall.input
        };
    }

    #toToolResult(toolResult: SdkToolResult): AIMessageToolResult{
        return {
            toolName: toolResult.toolName,
            input: toolResult.input,
            output: toolResult.output
        };
    }
}
