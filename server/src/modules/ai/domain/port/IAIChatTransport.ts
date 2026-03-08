import type { Response } from 'express';
import type { AIConversationMessage } from '@modules/ai/domain/contracts/AIConversationMessage';
import type { AIMessageToolStep } from '@modules/ai/domain/entities/AIMessage';
import type { TeamAIProvider } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';

export interface AIChatReplyStream {
    consumeText(): Promise<string>;
    pipeToResponse(response: Response): void;
};

export interface AIChatReplyUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
};

export interface AIChatFinishEvent {
    text: string;
    totalUsage?: AIChatReplyUsage | null;
    finishReason: string;
    steps: AIMessageToolStep[];
    responseMessages: unknown[];
    provider: string;
    model: string;
};

export interface GenerateAIChatReplyInput {
    teamId: string;
    userId: string;
    provider?: TeamAIProvider;
    model?: string;
    messages: AIConversationMessage[];
    onFinish?: (event: AIChatFinishEvent) => Promise<void>;
};

export interface IAIChatTransport {
    generateReplyStream(input: GenerateAIChatReplyInput): Promise<AIChatReplyStream>;
};
