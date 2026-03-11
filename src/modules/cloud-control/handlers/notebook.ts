import type { JupyterRuntimeService } from '@/modules/jupyter';
import type { CreateNotebookSessionRequest, NotebookSessionSnapshot } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import { isRecord } from '@/shared/utils';
import {
    readOptionalPayloadRecord,
    readOptionalString,
    readOptionalStringRecord,
    readOptionalUnknownRecord,
    readRecord,
    readString
} from './payloadValidation';

interface NotebookHandlersDependencies {
    jupyterRuntimeService: JupyterRuntimeService;
};

interface NotebookIdentifierPayload {
    notebookId: string;
};

interface NotebookProxyRequestPayload extends NotebookIdentifierPayload {
    proxiedPath: string;
    rawQuery: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
};

const readNotebookSessionSnapshot = (value: unknown): NotebookSessionSnapshot => {
    const record = readRecord(value, 'notebook');
    const snapshot: NotebookSessionSnapshot = {
        _id: readString(record._id, 'notebook._id'),
        teamId: readString(record.teamId, 'notebook.teamId'),
        notebookPath: readString(record.notebookPath, 'notebook.notebookPath')
    };
    const content = readOptionalUnknownRecord(record.content, 'notebook.content');

    if (content) {
        snapshot.content = content;
    }

    return snapshot;
};

const readNotebookIdentifierPayload = (payload: unknown): NotebookIdentifierPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        notebookId: readString(record.notebookId, 'notebookId')
    };
};

const readNotebookSessionRequestPayload = (payload: unknown): CreateNotebookSessionRequest => {
    const record = readOptionalPayloadRecord(payload);

    return {
        notebookId: readString(record.notebookId, 'notebookId'),
        requestedBy: readString(record.requestedBy, 'requestedBy'),
        publicBasePath: readString(record.publicBasePath, 'publicBasePath'),
        notebook: readNotebookSessionSnapshot(record.notebook)
    };
};

const readNotebookProxyBody = (value: unknown): string | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (isRecord(value)) {
        return JSON.stringify(value);
    }

    return undefined;
};

const readNotebookProxyRequestPayload = (payload: unknown): NotebookProxyRequestPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        notebookId: readString(record.notebookId, 'notebookId'),
        proxiedPath: readOptionalString(record.proxiedPath, '/'),
        rawQuery: readOptionalString(record.rawQuery),
        method: readOptionalString(record.method, 'GET'),
        headers: readOptionalStringRecord(record.headers, 'headers'),
        body: readNotebookProxyBody(record.body)
    };
};

export const createNotebookHandlers = (deps: NotebookHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'notebook.delete',
        execute: async (payload) => {
            const request = readNotebookIdentifierPayload(payload);
            return {
                data: {
                    deleted: await deps.jupyterRuntimeService.deleteSession(request.notebookId)
                }
            };
        }
    },
    {
        command: 'notebook.runtime.get',
        execute: async (payload) => {
            const request = readNotebookIdentifierPayload(payload);
            return {
                data: {
                    hostPort: await deps.jupyterRuntimeService.getRuntimeHostPort(request.notebookId)
                }
            };
        }
    },
    {
        command: 'notebook.session.create',
        execute: async (payload) => {
            const request = readNotebookSessionRequestPayload(payload);
            if (request.notebook._id !== request.notebookId) {
                throw new Error('notebookId must match notebook._id');
            }

            return {
                data: await deps.jupyterRuntimeService.ensureSession({
                    notebook: request.notebook,
                    requestedBy: request.requestedBy,
                    publicBasePath: request.publicBasePath
                }),
                status: 201
            };
        }
    },
    {
        command: 'notebook.proxy.http',
        execute: async (payload) => {
            const request = readNotebookProxyRequestPayload(payload);
            const hostPort = await deps.jupyterRuntimeService.getRuntimeHostPort(request.notebookId);
            if (!hostPort) {
                throw new Error('Jupyter runtime is not available');
            }

            const targetUrl = `http://127.0.0.1:${hostPort}${request.proxiedPath}${request.rawQuery}`;
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body
            });
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            return {
                status: response.status,
                headers: responseHeaders,
                stream: response.body || undefined
            };
        }
    }
];
