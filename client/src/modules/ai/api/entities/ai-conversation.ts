import type { AIProvider } from '@/modules/ai/api/entities/ai-provider';
import type { BaseEntity } from '@/shared/domain/entities/BaseEntity';
import type { UIMessage } from 'ai';

export interface AIConversationMessageArtifacts {
    items?: AIMessageArtifact[];
    [key: string]: unknown;
}

export enum AIMessageRole {
    User = 'user',
    Assistant = 'assistant'
}

export enum AIMessageArtifactKind {
    Table = 'table',
    Chart = 'chart',
    Image = 'image',
    Text = 'text',
    Unknown = 'unknown'
}

export interface AIMessageArtifact {
    id: string;
    messageId: string;
    kind: AIMessageArtifactKind;
    title: string;
    summary?: string;
    payload: unknown;
    toolName?: string | null;
}

export interface AIConversation extends BaseEntity {
    userId: string;
    teamId: string;
    title: string;
    lastMessageAt?: string | null;
    lastProvider?: AIProvider | string | null;
    lastModel?: string | null;
    isArchived: boolean;
}

export interface AIConversationMessage extends BaseEntity {
    conversationId: string;
    role: AIMessageRole;
    /** UIMessage-compatible parts stored directly from the SDK. */
    parts: UIMessage['parts'];
    content: string;
    artifacts?: AIConversationMessageArtifacts | null;
    modelInfo?: Record<string, unknown> | null;
    tokenUsage?: Record<string, unknown> | null;
}
