import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import { isRecord } from '@/modules/ai/components/organisms/AIConversationThread/thread-utils';

export interface AITabularArtifactPayload {
    columns: string[];
    rows: Record<string, unknown>[];
}

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
