import type { JupyterRuntimeService } from '@/modules/notebook/application/runtime/JupyterRuntimeService';
import { ChannelCommands } from '@/core/reverse-channel/contracts/reverseChannel.constants';
import type { CreateNotebookSessionRequest } from '@/contracts';
import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';

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
        command: ChannelCommands.NotebookDelete,
        execute: async (payload) => {
            const request = payload as unknown as NotebookIdentifierPayload;
            return {
                data: {
                    deleted: await deps.jupyterRuntimeService.deleteSession(request.notebookId)
                }
            };
        }
    },
    {
        command: ChannelCommands.NotebookRuntimeGet,
        execute: async (payload) => {
            const request = payload as unknown as NotebookIdentifierPayload;
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
        command: ChannelCommands.NotebookSessionCreate,
        execute: async (payload) => {
            const request = payload as unknown as CreateNotebookSessionRequest;

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
