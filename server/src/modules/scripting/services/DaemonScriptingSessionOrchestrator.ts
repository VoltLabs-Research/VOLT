export type { NotebookContainerStage } from '@volt/contracts/modules/scripting/domain';
import type { NotebookContainerStage } from '@volt/contracts/modules/scripting/domain';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import { attachScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import type { ScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import { buildJupyterProxyBasePath, buildJupyterProxyUrl, resolveServerBaseUrl } from '@modules/scripting/services/ScriptingJupyterProxySupport';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';

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

interface ScriptingSessionStartResult {
    notebookId: string;
    jupyter: ScriptingSessionJupyterInfo;
    accessGrant: ScriptingJupyterAccessGrant;
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

class DaemonScriptingSessionOrchestrator {
    private readonly notebookService = new JupyterNotebookService();
    private readonly accessTokenService = new ScriptingJupyterAccessTokenService();
    private readonly notebookRuntimeTerminator = notebookRuntimeTerminator;

        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    private readonly teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

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
        await ScriptingNotebook.update(
            { id: input.notebookId },
            {
                runtimeNotebookId,
                teamCluster: teamClusterId
            }
        );

        const jupyter = this.requireDaemonJupyterResponse(response);
        const daemonPath = jupyter.internalPath;
        const accessGrant = this.accessTokenService.createAccessGrant({
            teamId: input.teamId,
            runtimeNotebookId,
            userId: input.userId
        });
        const jupyterUrl = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            daemonPath,
            accessToken: accessGrant.token
        });
        return attachScriptingJupyterAccessGrant({
            notebookId: input.notebookId,
            jupyter: {
                ...jupyter,
                url: jupyterUrl,
                containerStage: jupyter.containerStage
            }
        }, accessGrant);
    }

    async deleteSession(trajectoryId: string): Promise<void> {
        const notebooks = await ScriptingNotebook.findBy({ trajectory: trajectoryId });

        for (const notebook of notebooks) {
            const notebookTeamClusterId = notebook.teamCluster || null;
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

export default new DaemonScriptingSessionOrchestrator();
