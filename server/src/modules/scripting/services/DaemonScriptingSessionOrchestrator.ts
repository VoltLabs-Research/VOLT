import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import type {
    IScriptingSessionOrchestrator,
    ScriptingSessionStartInput,
    ScriptingSessionStartResult
} from '@modules/scripting/ports/IScriptingSessionOrchestrator';
import { SCRIPTING_TOKENS } from '@modules/scripting/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/ports/IScriptingNotebookRepository';
import type { IJupyterNotebookService } from '@modules/scripting/ports/IJupyterNotebookService';
import type { IScriptingJupyterAccessTokenService } from '@modules/scripting/ports/IScriptingJupyterAccessTokenService';
import type { INotebookRuntimeTerminator } from '@modules/scripting/ports/INotebookRuntimeTerminator';
import { buildJupyterProxyBasePath, buildJupyterProxyUrl, resolveServerBaseUrl } from '@modules/scripting/utilities/jupyter-proxy';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { inject } from 'tsyringe';

type NotebookContainerStage = 'creating' | 'starting' | 'ready';

interface DaemonNotebookJupyterResponse {
    internalPath: string;
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
    baseUrl: string;
    secretKey?: string;
    trajectoryId?: string;
    notebook: DaemonNotebookSessionSnapshot;
}

const getNotebookTeamClusterId = (teamCluster: string | null | undefined): string | null => {
    return teamCluster ?? null;
};

@Singleton(SCRIPTING_TOKENS.ScriptingSessionOrchestrator)
export class DaemonScriptingSessionOrchestrator implements IScriptingSessionOrchestrator {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient,
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        @inject(SCRIPTING_TOKENS.JupyterNotebookService) private readonly notebookService: IJupyterNotebookService,
        @inject(SCRIPTING_TOKENS.ScriptingJupyterAccessTokenService) private readonly accessTokenService: IScriptingJupyterAccessTokenService,
        @inject(SCRIPTING_TOKENS.NotebookRuntimeTerminator) private readonly notebookRuntimeTerminator: INotebookRuntimeTerminator
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
            baseUrl: `${resolveServerBaseUrl()}/api`,
            secretKey: input.secretKey,
            trajectoryId: input.trajectoryId ?? undefined,
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
        const daemonPath = jupyter.internalPath;
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

            await this.notebookRuntimeTerminator.terminate(notebookTeamClusterId, notebook.props.runtimeNotebookId);
        }
    }

    async resolveNotebookTemplateContent(): Promise<Record<string, unknown>> {
        return this.notebookService.resolveNotebookTemplateContent();
    }

    private requireDaemonJupyterResponse(response: DaemonNotebookSessionResponse): DaemonNotebookJupyterResponse {
        if (response?.jupyter?.internalPath) {
            return response.jupyter;
        }

        throw ApplicationError.internalServerError('Daemon returned an invalid Jupyter session response');
    }
}
