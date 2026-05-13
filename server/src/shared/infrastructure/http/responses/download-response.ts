import { ExportType } from '@shared/domain/port/IBaseRepository';
import { toCsvContent } from '@shared/infrastructure/http/responses/ExportFileResponse';
import { Readable } from 'node:stream';

interface DownloadStreamOutput {
    stream: Readable;
    headers: Record<string, string>;
    prepare?: () => Promise<void>;
}

interface StreamResponseParams {
    stream: Readable;
    contentType: string;
    filename?: string;
    disposition?: 'attachment' | 'inline';
    contentLength?: number;
    cacheControl?: string;
    prepare?: () => Promise<void>;
    /**
     * Extra headers applied on top of the base set (e.g. `Content-Encoding`,
     * `Vary`). Callers use this to surface transport-level negotiation details
     * that the generic stream response does not synthesize itself.
     */
    extraHeaders?: Record<string, string>;
}

interface SerializedDownloadResponseParams {
    filename: string;
    format: ExportType;
    rows: Record<string, unknown>[];
    columns?: string[];
}

export const sanitizeDownloadName = (value: string, fallback = 'export'): string => {
    const normalizedValue = String(value || '')
        .trim()
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return normalizedValue || fallback;
};

export const createDownloadStreamResponse = ({
    stream,
    contentType,
    filename,
    disposition = 'attachment',
    contentLength,
    cacheControl,
    prepare,
    extraHeaders
}: StreamResponseParams): DownloadStreamOutput => {
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

    if (extraHeaders) {
        for (const [name, value] of Object.entries(extraHeaders)) {
            headers[name] = value;
        }
    }

    const response: DownloadStreamOutput = {
        stream,
        headers
    };

    if (prepare) {
        response.prepare = prepare;
    }

    return response;
};

export const createSerializedDownloadResponse = ({
    filename,
    format,
    rows,
    columns
}: SerializedDownloadResponseParams): DownloadStreamOutput => {
    let extension = 'json';
    let contentType = 'application/json; charset=utf-8';
    let content = JSON.stringify(rows, null, 2);

    if (format === ExportType.Csv) {
        extension = 'csv';
        contentType = 'text/csv; charset=utf-8';
        content = toCsvContent(rows, columns);
    }

    return createDownloadStreamResponse({
        stream: Readable.from([content]),
        contentType,
        filename: `${filename}.${extension}`
    });
};
