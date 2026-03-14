import type { JupyterRuntimeService } from '@/modules/jupyter';
import type { NotebookSessionSnapshot } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readOptionalPayloadRecord,
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

interface NotebookRuntimeTarget {
    tunnelTargetHost: string;
    tunnelTargetPort: number;
};

interface CreateNotebookSessionCommandPayload {
    requestedBy: string;
    publicBasePath: string;
    notebook: NotebookSessionSnapshot;
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

const readNotebookSessionRequestPayload = (payload: unknown): CreateNotebookSessionCommandPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        requestedBy: readString(record.requestedBy, 'requestedBy'),
        publicBasePath: readString(record.publicBasePath, 'publicBasePath'),
        notebook: readNotebookSessionSnapshot(record.notebook)
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
            const tunnelTargetPort = await deps.jupyterRuntimeService.getRuntimeHostPort(request.notebookId);
            const runtime: NotebookRuntimeTarget | null = typeof tunnelTargetPort === 'number'
                ? {
                    tunnelTargetHost: '127.0.0.1',
                    tunnelTargetPort
                }
                : null;

            return {
                data: {
                    runtime
                }
            };
        }
    },
    {
        command: 'notebook.session.create',
        execute: async (payload) => {
            const request = readNotebookSessionRequestPayload(payload);

            return {
                data: await deps.jupyterRuntimeService.ensureSession({
                    notebook: request.notebook,
                    requestedBy: request.requestedBy,
                    publicBasePath: request.publicBasePath
                }),
                status: 201
            };
        }
    }
];
