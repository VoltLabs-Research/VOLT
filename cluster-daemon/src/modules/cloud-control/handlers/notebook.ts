import type { JupyterRuntimeService, NotebookRepository } from '@/modules/jupyter';
import type { CreateNotebookRequest } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import { isRecord } from '@/shared/utils';
import { readOptionalPayloadRecord, readOptionalString, readOptionalStringRecord, readPayloadRecord, readString } from './payloadValidation';

interface NotebookHandlersDependencies {
    notebookRepository: NotebookRepository;
    jupyterRuntimeService: JupyterRuntimeService;
};

interface NotebookIdentifierPayload {
    notebookId: string;
};

interface NotebookSessionRequestPayload extends NotebookIdentifierPayload {
    requestedBy: string;
    publicBasePath: string;
};

interface NotebookProxyRequestPayload extends NotebookIdentifierPayload {
    proxiedPath: string;
    rawQuery: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
};

const readCreateNotebookRequest = (payload: unknown): CreateNotebookRequest => {
    const record = readPayloadRecord(payload);
    const trajectoriesValue = record.trajectories;

    if (!Array.isArray(trajectoriesValue)) {
        throw new Error('trajectories must be an array');
    }

    const trajectories = trajectoriesValue.map((entry) => readString(entry, 'trajectories'));
    const request: CreateNotebookRequest = {
        teamId: readString(record.teamId, 'teamId'),
        title: readString(record.title, 'title'),
        notebookPath: readString(record.notebookPath, 'notebookPath'),
        trajectories,
        createdBy: readString(record.createdBy, 'createdBy')
    };

    if (typeof record._id !== 'undefined') {
        request._id = readString(record._id, '_id');
    }

    if (typeof record.content !== 'undefined') {
        request.content = readPayloadRecord(record.content);
    }

    return request;
};

const readNotebookIdentifierPayload = (payload: unknown): NotebookIdentifierPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        notebookId: readString(record.notebookId, 'notebookId')
    };
};

const readNotebookSessionRequestPayload = (payload: unknown): NotebookSessionRequestPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        notebookId: readString(record.notebookId, 'notebookId'),
        requestedBy: readString(record.requestedBy, 'requestedBy'),
        publicBasePath: readString(record.publicBasePath, 'publicBasePath')
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
        command: 'notebook.create',
        execute: async (payload) => ({
            data: await deps.notebookRepository.createNotebook(readCreateNotebookRequest(payload)),
            status: 201
        })
    },
    {
        command: 'notebook.delete',
        execute: async (payload) => {
            const request = readNotebookIdentifierPayload(payload);
            await deps.jupyterRuntimeService.deleteSession(request.notebookId);
            return {
                data: {
                    deleted: await deps.notebookRepository.deleteNotebook(request.notebookId)
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
            const notebook = await deps.notebookRepository.getNotebookById(request.notebookId);
            if (!notebook) {
                throw new Error('Notebook not found');
            }

            return {
                data: await deps.jupyterRuntimeService.ensureSession({
                    notebook,
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
