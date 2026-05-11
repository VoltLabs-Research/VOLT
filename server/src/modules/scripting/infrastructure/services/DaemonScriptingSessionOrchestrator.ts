import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import type {
    DefaultNotebookTemplateContext,
    IScriptingSessionOrchestrator,
    ScriptingSessionStartInput,
    ScriptingSessionStartResult
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import ScriptingNotebookRepository from '@modules/scripting/infrastructure/persistence/mongo/repositories/ScriptingNotebookRepository';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import { buildJupyterProxyBasePath, buildJupyterProxyUrl } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

type NotebookContainerStage = 'creating' | 'starting' | 'ready';

interface DaemonNotebookJupyterResponse {
    internalPath: string;
    url?: string;
    ready: boolean;
    containerStage?: NotebookContainerStage;
}

interface DaemonNotebookSessionResponse {
    jupyter: DaemonNotebookJupyterResponse;
}

interface DaemonNotebookSessionSnapshot {
    [key: string]: unknown;
    _id: string;
    teamId: string;
    notebookPath: string;
    content?: Record<string, unknown>;
}

interface DaemonNotebookSessionRequest {
    [key: string]: unknown;
    requestedBy: string;
    publicBasePath: string;
    notebook: DaemonNotebookSessionSnapshot;
}

const getNotebookTeamClusterId = (teamCluster: string | null | undefined): string | null => {
    return teamCluster ?? null;
};

@Singleton()
export class DaemonScriptingSessionOrchestrator implements IScriptingSessionOrchestrator {
    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,
        private readonly scriptingNotebookRepository: ScriptingNotebookRepository,
        private readonly teamClusterSelectionService: TeamClusterSelectionService,
        private readonly notebookService: JupyterNotebookService,
        private readonly accessTokenService: ScriptingJupyterAccessTokenService
    ) {}

    async startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult> {
        const teamClusterId = await this.teamClusterSelectionService.resolveConnectedClusterId(input.teamId, input.teamClusterId);
        if (!input.notebookId) {
            throw ApplicationError.badRequest('Scripting::NotebookRequired', 'Notebook id is required to start a remote notebook session');
        }
        if (!input.notebook) {
            throw ApplicationError.badRequest('Scripting::NotebookSnapshotRequired', 'Notebook snapshot is required to start a remote notebook session');
        }

        const runtimeNotebookId = input.notebookId;
        const request: DaemonNotebookSessionRequest = {
            requestedBy: input.userId,
            publicBasePath: buildJupyterProxyBasePath(input.teamId, runtimeNotebookId),
            notebook: {
                _id: runtimeNotebookId,
                teamId: input.teamId,
                notebookPath: input.notebook.notebookPath,
                content: input.notebook.content
            }
        };

        const response = await this.teamClusterDaemonClient.command<DaemonNotebookSessionResponse>(
            teamClusterId,
            ChannelCommands.NotebookSessionCreate,
            request,
            { timeoutMs: 600_000 }
        );
        await this.scriptingNotebookRepository.updateById(input.notebookId, {
            runtimeNotebookId,
            teamCluster: teamClusterId
        });

        const jupyter = this.requireDaemonJupyterResponse(response);
        const daemonPath = this.resolveDaemonJupyterPath(jupyter);
        const accessToken = this.accessTokenService.create({
            teamId: input.teamId,
            runtimeNotebookId,
            userId: input.userId
        });
        const jupyterUrl = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            daemonPath,
            accessToken
        });
        return {
            notebookId: input.notebookId,
            jupyter: {
                ...jupyter,
                url: jupyterUrl,
                containerStage: jupyter.containerStage
            }
        };
    }

    async deleteSession(trajectoryId: string): Promise<void> {
        const notebooks = await this.scriptingNotebookRepository.findAllWithTrajectory(trajectoryId);

        for (const notebook of notebooks) {
            const notebookTeamClusterId = getNotebookTeamClusterId(notebook.props.teamCluster);
            if (!notebook.props.runtimeNotebookId || !notebookTeamClusterId) {
                continue;
            }

            try {
                await this.teamClusterDaemonClient.command(
                    notebookTeamClusterId,
                    ChannelCommands.NotebookDelete,
                    {
                        notebookId: notebook.props.runtimeNotebookId
                    }
                );
            } catch (error: unknown) {
                logger.warn(
                    { err: error, notebookId: notebook._id, runtimeNotebookId: notebook.props.runtimeNotebookId, trajectoryId },
                    '[Scripting] Failed to delete Jupyter session on daemon'
                );
            }
        }
    }

    async resolveNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<Record<string, unknown>> {
        return this.notebookService.resolveNotebookTemplateContent(context);
    }

    private requireDaemonJupyterResponse(response: DaemonNotebookSessionResponse): DaemonNotebookJupyterResponse {
        if (response?.jupyter?.internalPath) {
            return response.jupyter;
        }

        throw ApplicationError.internalServerError('Daemon returned an invalid Jupyter session response');
    }

    private resolveDaemonJupyterPath(jupyter: DaemonNotebookJupyterResponse): string {
        return jupyter.internalPath;
    }
}
