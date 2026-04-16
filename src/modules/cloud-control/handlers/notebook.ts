import type { JupyterRuntimeService } from '@/modules/jupyter';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts/reverseChannel';
import type { CreateNotebookSessionRequest } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';

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
            const request = payload as NotebookIdentifierPayload;
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
            const request = payload as NotebookIdentifierPayload;
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
            const request = payload as CreateNotebookSessionRequest;

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
