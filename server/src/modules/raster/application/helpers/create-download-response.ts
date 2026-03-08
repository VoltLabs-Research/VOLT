import type { DownloadStreamOutputDTO } from '@modules/raster/application/dtos/shared/DownloadStreamOutputDTO';
import type { Readable } from 'node:stream';

interface StreamResponseParams {
    stream: Readable;
    contentType: string;
    filename?: string;
    disposition?: 'attachment' | 'inline';
    contentLength?: number;
    cacheControl?: string;
    prepare?: () => Promise<void>;
}

export const sanitizeDownloadName = (
    value: string,
    fallback = 'export'
): string => {
    const normalizedValue = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (!normalizedValue) {
        return fallback;
    }

    return normalizedValue;
};

export const createStreamResponse = ({
    stream,
    contentType,
    filename,
    disposition = 'attachment',
    contentLength,
    cacheControl,
    prepare
}: StreamResponseParams): DownloadStreamOutputDTO => {
    const headers: Record<string, string> = {
        'Content-Type': contentType,
        'X-Content-Type-Options': 'nosniff'
    };

    if (filename) {
        const safeFilename = sanitizeDownloadName(filename);
        headers['Content-Disposition'] = `${disposition}; filename="${safeFilename}"`;
    }

    if (typeof contentLength === 'number' && Number.isFinite(contentLength)) {
        headers['Content-Length'] = String(contentLength);
    }

    if (cacheControl) {
        headers['Cache-Control'] = cacheControl;
    }

    const response: DownloadStreamOutputDTO = {
        stream,
        headers
    };

    if (prepare) {
        response.prepare = prepare;
    }

    return response;
};
