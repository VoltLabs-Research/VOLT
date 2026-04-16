import type { RemoteExplorerMongoDocument } from '@/shared/contracts';
import { isRecord } from '@/shared/utilities/type-guards';
import { Readable } from 'node:stream';

interface DownloadFilenameParts {
    fallback: string;
    encoded: string;
};

interface ParsedMinioPath {
    bucket: string;
    objectKey: string;
};

interface ParsedRedisKeyPath {
    databaseId: number;
    key: string;
};

export const MAX_MONGO_DOCUMENTS = 100;
export const MAX_OBJECT_PREVIEW_BYTES = 65_536;

const buildDownloadFilenameParts = (filename: string): DownloadFilenameParts => {
    const normalizedFilename = filename
        .replace(/[\r\n]+/g, ' ')
        .trim();
    const safeBaseName = normalizedFilename || 'download';
    const fallback = safeBaseName
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        || 'download';

    return {
        fallback,
        encoded: encodeURIComponent(safeBaseName)
    };
};

export const toWebReadableStream = (stream: Readable): ReadableStream => {
    return new ReadableStream<Uint8Array>({
        start(controller) {
            const handleData = (chunk: Buffer): void => {
                controller.enqueue(new Uint8Array(chunk));
            };
            const handleEnd = (): void => {
                controller.close();
                cleanup();
            };
            const handleError = (error: Error): void => {
                controller.error(error);
                cleanup();
            };
            const cleanup = (): void => {
                stream.removeListener('data', handleData);
                stream.removeListener('end', handleEnd);
                stream.removeListener('error', handleError);
            };

            stream.on('data', handleData);
            stream.on('end', handleEnd);
            stream.on('error', handleError);
        },
        cancel() {
            stream.destroy();
        }
    });
};

export const buildAttachmentContentDisposition = (filename: string): string => {
    const parts = buildDownloadFilenameParts(filename);
    return `attachment; filename="${parts.fallback}"; filename*=UTF-8''${parts.encoded}`;
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

export const parseMinioPath = (path: string): ParsedMinioPath | null => {
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

export const parseRedisDatabasePath = (path: string): number | null => {
    const segments = splitExplorerPathSegments(path);
    if (segments.length < 2 || segments[0] !== 'db') {
        return null;
    }

    const databaseId = Number(segments[1]);
    return Number.isInteger(databaseId) ? databaseId : null;
};

export const parseRedisKeyPath = (path: string): ParsedRedisKeyPath | null => {
    const segments = splitExplorerPathSegments(path);
    if (segments.length < 4 || segments[0] !== 'db' || segments[2] !== 'key') {
        return null;
    }

    const databaseId = Number(segments[1]);
    if (!Number.isInteger(databaseId)) {
        return null;
    }

    return {
        databaseId,
        key: decodeURIComponent(segments.slice(3).join('/'))
    };
};

export const toMongoDocument = (value: unknown): RemoteExplorerMongoDocument => {
    const jsonString = JSON.stringify(value);
    const parsedValue: unknown = jsonString ? JSON.parse(jsonString) : {};
    const recordValue = isRecord(parsedValue)
        ? parsedValue
        : {};

    const idValue = recordValue._id;
    const id = typeof idValue === 'string'
        ? idValue
        : JSON.stringify(idValue ?? '');

    return {
        id,
        value: recordValue
    };
};
