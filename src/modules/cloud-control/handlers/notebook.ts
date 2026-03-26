import type { JupyterRuntimeService } from '@/modules/jupyter';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts/reverseChannel';
import type { NotebookSessionSnapshot } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readNumber,
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
    containerResources: {
        cpus: number;
        memoryMB: number;
    };
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
    const containerResourcesRecord = readRecord(record.containerResources, 'containerResources');

    return {
        requestedBy: readString(record.requestedBy, 'requestedBy'),
        publicBasePath: readString(record.publicBasePath, 'publicBasePath'),
        notebook: readNotebookSessionSnapshot(record.notebook),
        containerResources: {
            cpus: readNumber(containerResourcesRecord.cpus, 'containerResources.cpus'),
            memoryMB: readNumber(containerResourcesRecord.memoryMB, 'containerResources.memoryMB')
        }
    };
};

const getReadinessGatedRuntimeTarget = async (
    jupyterRuntimeService: JupyterRuntimeService,
    notebookId: string
): Promise<NotebookRuntimeTarget | null> => {
    const runtimeTarget = await jupyterRuntimeService.getReadyRuntimeTunnelTarget(notebookId);
    if (!runtimeTarget) {
        return null;
    }

    return {
        tunnelTargetHost: runtimeTarget.host,
        tunnelTargetPort: runtimeTarget.port
    };
};

export const createNotebookHandlers = (deps: NotebookHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.notebook.delete,
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
        command: TEAM_CLUSTER_DAEMON_COMMAND.notebook.runtime.get,
        execute: async (payload) => {
            const request = readNotebookIdentifierPayload(payload);
            const runtime = await getReadinessGatedRuntimeTarget(
                deps.jupyterRuntimeService,
                request.notebookId
            );

            return {
                data: {
                    runtime
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.notebook.session.create,
        execute: async (payload) => {
            const request = readNotebookSessionRequestPayload(payload);

            return {
                data: await deps.jupyterRuntimeService.ensureSession({
                    notebook: request.notebook,
                    requestedBy: request.requestedBy,
                    publicBasePath: request.publicBasePath,
                    containerResources: request.containerResources
                }),
                status: 201
            };
        }
    }
];
