import { PassThrough, Readable } from 'node:stream';
import archiver from 'archiver';
import type { Archiver } from 'archiver';
import type { ExportType } from '@shared/domain/port/IBaseRepository';
import { toCsvContent } from '@shared/infrastructure/http/responses/ExportFileResponse';
import type { DownloadStreamOutputDTO } from '@modules/plugin/application/dtos/shared/DownloadStreamOutputDTO';

interface StreamResponseParams {
    stream: Readable;
    contentType: string;
    filename?: string;
    disposition?: 'attachment' | 'inline';
    contentLength?: number;
    cacheControl?: string;
    prepare?: () => Promise<void>;
}

interface SerializedDownloadResponseParams {
    filename: string;
    format: ExportType;
    rows: Record<string, unknown>[];
    columns?: string[];
}

interface ZipDownloadResponseParams {
    filename: string;
    cacheControl?: string;
    prepare?: () => Promise<void>;
    appendEntries: (archive: Archiver) => Promise<void>;
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
        'Content-Type': contentType
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

    headers['X-Content-Type-Options'] = 'nosniff';

    const response: DownloadStreamOutputDTO = {
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
}: SerializedDownloadResponseParams): DownloadStreamOutputDTO => {
    let extension = 'json';
    let contentType = 'application/json; charset=utf-8';
    let content = JSON.stringify(rows, null, 2);

    if (format === 'csv') {
        extension = 'csv';
        contentType = 'text/csv; charset=utf-8';
        content = toCsvContent(rows, columns);
    }

    return createStreamResponse({
        stream: Readable.from([content]),
        contentType,
        filename: `${filename}.${extension}`
    });
};

export const createZipArchiveStream = (
    appendEntries: (archive: Archiver) => Promise<void>
): PassThrough => {
    const output = new PassThrough();
    const archive = archiver('zip', {
        zlib: {
            level: 5
        }
    });

    archive.on('error', (error) => output.destroy(error));
    archive.pipe(output);

    void (async () => {
        await appendEntries(archive);
        await archive.finalize();
    })().catch((error) => output.destroy(error));

    return output;
};

export const createZipDownloadResponse = ({
    filename,
    cacheControl,
    prepare,
    appendEntries
}: ZipDownloadResponseParams): DownloadStreamOutputDTO => {
    return createStreamResponse({
        stream: createZipArchiveStream(appendEntries),
        contentType: 'application/zip',
        filename: `${filename}.zip`,
        cacheControl,
        prepare
    });
};
