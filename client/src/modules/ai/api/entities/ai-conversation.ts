import type { AIProvider } from '@/modules/ai/api/entities/ai-constants';
import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';

export type AIMessageRole = 'user' | 'assistant';
export type AIMessageArtifactKind = 'table' | 'chart' | 'image' | 'text' | 'unknown';

export interface AIMessageArtifact {
    id: string;
    messageId: string;
    kind: AIMessageArtifactKind;
    title: string;
    summary?: string;
    payload: unknown;
    toolName?: string | null;
};

export interface AIConversation extends BaseEntity {
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: string | null;
    lastProvider?: AIProvider | string | null;
    lastModel?: string | null;
    isArchived: boolean;
};

export interface AIConversationMessage extends BaseEntity {
    conversationId: string;
    role: AIMessageRole;
    /** UIMessage-compatible parts stored directly from the SDK. */
    parts: unknown[];
    content: string;
    artifacts?: {
        items?: AIMessageArtifact[];
        [key: string]: unknown;
    } | null;
    modelInfo?: Record<string, unknown> | null;
    tokenUsage?: Record<string, unknown> | null;
};
