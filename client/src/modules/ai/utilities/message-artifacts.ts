import { AIMessageArtifactKind } from '@/modules/ai/api/entities/ai-conversation';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import { isRecord } from '@/shared/utils/type-guards';

export interface AITabularArtifactPayload {
    columns: string[];
    rows: Record<string, unknown>[];
};

export const resolveTabularPayload = (artifact: AIMessageArtifact): AITabularArtifactPayload | null => {
    if (artifact.kind !== AIMessageArtifactKind.Table || !isRecord(artifact.payload)) {
        return null;
    }

    let columns: string[] = [];
    if (Array.isArray(artifact.payload.columns)) {
        columns = artifact.payload.columns.filter((column): column is string => typeof column === 'string');
    }

    let rows: Record<string, unknown>[] = [];
    if (Array.isArray(artifact.payload.rows)) {
        rows = artifact.payload.rows.filter(isRecord);
    }

    if (!columns.length) {
        return null;
    }

    return { columns, rows };
};
