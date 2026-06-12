import { AIMessageArtifactKind } from '@/modules/ai/api/entities/ai-conversation';
import type { AIMessageArtifact } from '@/modules/ai/api/entities/ai-conversation';
import { getBackendOrigin } from '@/app/core/http/utilities/backend-origin';
import { isRecord } from '@/shared/utils/type-guards';

export interface AITabularArtifactPayload {
    columns: string[];
    rows: Record<string, unknown>[];
}

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

export interface AIImageArtifactPayload {
    url: string;
    mediaType: string;
    summary?: string;
}

/**
 * Validates that an image URL is safe to render as <img src>. Allows:
 *  - relative API paths (e.g. "/api/rasters/.../frames/...") served same-origin,
 *  - absolute URLs on the configured backend origin,
 *  - inline data:image/* URLs.
 * Rejects everything else (external hosts, javascript:, etc.) — image URLs can
 * originate from tool output influenced by untrusted content.
 */
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

/**
 * Resolves an image payload from an artifact OR from a raw tool-result object
 * (the live stream exposes tool output directly, not yet promoted to an
 * artifact). Returns null when the payload is not a valid, allowed image.
 */
export const resolveImagePayload = (source: AIMessageArtifact | unknown): AIImageArtifactPayload | null => {
    let payload: unknown = source;
    if (isRecord(source) && 'kind' in source && 'payload' in source) {
        const artifact = source as unknown as AIMessageArtifact;
        if (artifact.kind !== AIMessageArtifactKind.Image) {
            return null;
        }
        payload = artifact.payload;
    }

    if (!isRecord(payload)) {
        return null;
    }

    if (payload.payloadType !== undefined && payload.payloadType !== 'image') {
        return null;
    }

    const url = typeof payload.url === 'string' ? payload.url : null;
    if (!url || !isAllowedImageUrl(url)) {
        return null;
    }

    const mediaType = typeof payload.mediaType === 'string' ? payload.mediaType : 'image/png';
    const summary = typeof payload.summary === 'string' ? payload.summary : undefined;

    return { url, mediaType, summary };
};
