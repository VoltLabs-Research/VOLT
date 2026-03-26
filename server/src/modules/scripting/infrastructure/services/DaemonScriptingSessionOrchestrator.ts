import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { buildJupyterProxyBasePath, buildJupyterProxyUrl } from '@modules/scripting/infrastructure/utilities/jupyter-proxy';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type {
    DefaultNotebookTemplateContext,
    IScriptingSessionOrchestrator,
    ScriptingSessionStartInput,
    ScriptingSessionStartResult
} from '@modules/scripting/domain/port/IScriptingSessionOrchestrator';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';

type NotebookContainerStage = 'creating' | 'starting' | 'ready';

interface DaemonNotebookJupyterResponse {
    internalPath: string;
    url?: string;
    ready: boolean;
    containerStage?: NotebookContainerStage;
};

interface DaemonNotebookSessionResponse {
    jupyter: DaemonNotebookJupyterResponse;
};

interface DaemonNotebookSessionSnapshot {
    [key: string]: unknown;
    _id: string;
    teamId: string;
    notebookPath: string;
    content?: Record<string, unknown>;
};

interface DaemonNotebookSessionRequest {
    [key: string]: unknown;
    requestedBy: string;
    publicBasePath: string;
    containerResources: {
        cpus: number;
        memoryMB: number;
    };
    notebook: DaemonNotebookSessionSnapshot;
};

const getNotebookTeamClusterId = (teamCluster: string | null | undefined): string | null => {
    return teamCluster ?? null;
};

@injectable()
export class DaemonScriptingSessionOrchestrator implements IScriptingSessionOrchestrator {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient,

        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository)
        private readonly scriptingNotebookRepository: IScriptingNotebookRepository,

        @inject(TeamClusterSelectionService)
        private readonly teamClusterSelectionService: TeamClusterSelectionService,

        @inject(JupyterNotebookService)
        private readonly notebookService: JupyterNotebookService,

        @inject(ScriptingJupyterAccessTokenService)
        private readonly accessTokenService: ScriptingJupyterAccessTokenService
    ) {}

    async startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult> {
        const teamClusterId = await this.teamClusterSelectionService.resolveTeamClusterId(input.teamId, input.teamClusterId);
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
            containerResources: {
                cpus: input.containerResources.cpus,
                memoryMB: input.containerResources.memoryMB
            },
            notebook: {
                _id: runtimeNotebookId,
                teamId: input.teamId,
                notebookPath: input.notebook.notebookPath,
                content: input.notebook.content
            }
        };

        const response = await this.teamClusterDaemonClient.command<DaemonNotebookSessionResponse>(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_COMMAND.notebook.session.create,
            request,
            { timeoutMs: 600_000 }
        );
        await this.scriptingNotebookRepository.updateById(input.notebookId, {
            runtimeNotebookId,
            teamCluster: teamClusterId
        });

        const daemonPath = this.resolveDaemonJupyterPath(response.jupyter);
        const jupyterUrl = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            daemonPath,
            userId: input.userId,
            createAccessToken: this.accessTokenService.create.bind(this.accessTokenService)
        });
        return {
            notebookId: input.notebookId,
            jupyter: {
                ...response.jupyter,
                url: jupyterUrl,
                containerStage: response.jupyter.containerStage
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
                    TEAM_CLUSTER_DAEMON_COMMAND.notebook.delete,
                    {
                        notebookId: notebook.props.runtimeNotebookId
                    }
                );
            } catch (error: unknown) {
                logger.warn(
                    { err: error, notebookId: notebook.id, runtimeNotebookId: notebook.props.runtimeNotebookId, trajectoryId },
                    '[Scripting] Failed to delete Jupyter session on daemon'
                );
            }
        }
    }

    async resolveNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<Record<string, unknown>> {
        return this.notebookService.resolveNotebookTemplateContent(context);
    }

    private resolveDaemonJupyterPath(jupyter: DaemonNotebookJupyterResponse): string {
        return jupyter.internalPath;
    }
};
