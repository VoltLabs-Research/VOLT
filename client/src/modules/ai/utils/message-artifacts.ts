import { AIMessageArtifactKind } from '@volt/contracts/modules/ai/domain';
import type { AIMessageArtifact } from '@volt/contracts/modules/ai/domain';
import { getBackendOrigin } from '@/app/core/http/utils/backend-origin';
import { isRecord } from '@/shared/utils/type-guards';

interface AITabularArtifactPayload {
    columns: string[];
    rows: Record<string, unknown>[];
}

/** Table payloads come from parsed markdown or an uploaded sheet, so shape is checked before use. */
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

    return {
        columns,
        rows
    };
};

interface AIImageArtifactPayload {
    url: string;
    summary?: string;
}

const isAllowedImageUrl = (url: string): boolean => {
    if (url.startsWith('data:image/')) {
        return true;
    }

    if (url.startsWith('/')) {
        return !url.startsWith('//');
    }

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return false;
        }
        const backendOrigin = new URL(getBackendOrigin()).origin;
        return parsed.origin === backendOrigin || parsed.origin === window.location.origin;
    } catch {
        return false;
    }
};

/** Tool outputs reach us as `unknown`, so an image result is only trusted once its url checks out. */
export const resolveImagePayload = (output: unknown): AIImageArtifactPayload | null => {
    if (!isRecord(output)) {
        return null;
    }

    if (output.payloadType !== undefined && output.payloadType !== 'image') {
        return null;
    }

    const url = typeof output.url === 'string' ? output.url : null;
    if (!url || !isAllowedImageUrl(url)) {
        return null;
    }

    return {
        url,
        summary: typeof output.summary === 'string' ? output.summary : undefined
    };
};
