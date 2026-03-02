import type {
    AIConversationMessage,
    AIMessageArtifact
} from '@/modules/ai/domain/entities/AIConversation';

export type { AIMessageArtifact } from '@/modules/ai/domain/entities/AIConversation';

export interface AITabularArtifactPayload {
    columns: string[];
    rows: Record<string, unknown>[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    return !Array.isArray(value);
};

export const extractMessageArtifacts = (message: AIConversationMessage): AIMessageArtifact[] => {
    return Array.isArray(message.artifacts?.items)
        ? message.artifacts.items
        : [];
};

export const resolveTabularPayload = (artifact: AIMessageArtifact): AITabularArtifactPayload | null => {
    if (artifact.kind !== 'table' || !isRecord(artifact.payload)) {
        return null;
    }

    const columns = Array.isArray(artifact.payload.columns)
        ? artifact.payload.columns.filter((column): column is string => typeof column === 'string')
        : [];
    const rows = Array.isArray(artifact.payload.rows)
        ? artifact.payload.rows.filter((row): row is Record<string, unknown> => isRecord(row))
        : [];

    if (!columns.length) {
        return null;
    }

    return { columns, rows };
};

export const getFirstTabularArtifact = (message: AIConversationMessage): AIMessageArtifact | null => {
    return extractMessageArtifacts(message).find((artifact) => artifact.kind === 'table') ?? null;
};
