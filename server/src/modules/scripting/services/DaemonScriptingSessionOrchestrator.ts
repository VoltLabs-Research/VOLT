import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import { NotebookRuntimeTerminator } from '@modules/scripting/services/NotebookRuntimeTerminator';
import { buildJupyterProxyBasePath, buildJupyterProxyUrl, resolveServerBaseUrl } from '@modules/scripting/utilities/jupyter-proxy';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import { inject } from 'tsyringe';

export type NotebookContainerStage = 'creating' | 'starting' | 'ready';

export interface ScriptingSessionNotebookInput {
    notebookPath: string;
    content?: Record<string, unknown>;
}

export interface ScriptingSessionJupyterInfo {
    url: string;
    ready: boolean;
    containerStage?: NotebookContainerStage;
}

export interface ScriptingSessionStartInput {
    teamId: string;
    teamClusterId: string;
    userId: string;
    notebook?: ScriptingSessionNotebookInput;
    notebookId?: string;
    secretKey?: string;
    trajectoryId?: string | null;
}

export interface ScriptingSessionStartResult {
    notebookId: string;
    jupyter: ScriptingSessionJupyterInfo;
}

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

/**
 * Shared singleton (stateful daemon collaborator): starts/tears-down remote
 * Jupyter notebook sessions over the {@link ITeamClusterDaemonClient}. Talks to
 * the Mongoose {@link ScriptingNotebookModel} directly (no repository) and injects
 * its stateless sibling collaborators by class. Consumed both by
 * {@link ScriptingService} (create-session flow) and the trajectory-deleted event
 * handler, so it stays a `@Singleton()` resolved once.
 */
@Singleton()
export class DaemonScriptingSessionOrchestrator {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        private readonly notebookService: JupyterNotebookService,
        private readonly accessTokenService: ScriptingJupyterAccessTokenService,
        private readonly notebookRuntimeTerminator: NotebookRuntimeTerminator
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
        await ScriptingNotebookModel.updateOne(
            { _id: input.notebookId },
            { $set: { runtimeNotebookId, teamCluster: teamClusterId } }
        );

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
        const notebooks = await ScriptingNotebookModel.find({ trajectory: trajectoryId }).exec();

        for (const notebook of notebooks) {
            const notebookTeamClusterId = notebook.teamCluster ? String(notebook.teamCluster) : null;
            if (!notebook.runtimeNotebookId || !notebookTeamClusterId) {
                continue;
            }

            await this.notebookRuntimeTerminator.terminate(notebookTeamClusterId, notebook.runtimeNotebookId);
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
