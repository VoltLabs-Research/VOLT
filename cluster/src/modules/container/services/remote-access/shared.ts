import type { RemoteExplorerDocument } from '@shared/contracts';
import { Readable } from 'node:stream';

interface ParsedObjectStorePath {
    bucket: string;
    objectKey: string;
}

export const MAX_EXPLORER_DOCUMENTS = 100;
export const MAX_OBJECT_PREVIEW_BYTES = 65_536;

export const toWebReadableStream = (stream: Readable): ReadableStream => {
    return Readable.toWeb(stream) as ReadableStream;
};

export const buildAttachmentContentDisposition = (filename: string): string => {
    const fallback = filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_');

    return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export const normalizeExplorerPath = (value: string): string => {
    return value.replace(/^\/+|\/+$/g, '');
};

export const splitExplorerPathSegments = (value: string): string[] => {
    return normalizeExplorerPath(value).split('/').filter(Boolean);
};

export const joinExplorerPathSegments = (...segments: string[]): string => {
    return segments.flatMap(splitExplorerPathSegments).join('/');
};

export const parseObjectStorePath = (path: string): ParsedObjectStorePath | null => {
    const segments = splitExplorerPathSegments(path);
    const [bucket, ...objectKeySegments] = segments;

    if (!bucket) {
        return null;
    }

    return {
        bucket,
        objectKey: objectKeySegments.join('/')
    };
};

export const toExplorerDocument = (value: RemoteExplorerDocument['value']): RemoteExplorerDocument => {
    const recordValue = structuredClone(value);
    const idValue = recordValue._id;
    const id = typeof idValue === 'string' ? idValue : JSON.stringify(idValue);

    return {
        id,
        value: recordValue
    };
};
