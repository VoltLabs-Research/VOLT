import type { NotebookContainerStage, ScriptingSessionJupyter } from '@volt/contracts/modules/scripting/domain';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import { attachScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import type { ScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import { buildJupyterProxyBasePath, buildJupyterProxyUrl } from '@modules/scripting/services/ScriptingJupyterProxySupport';
import { resolveServerBaseUrl } from '@shared/infrastructure/utilities/server-url';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';

export interface ScriptingSessionNotebookInput {
    notebookPath: string;
    content?: Record<string, unknown>;
}

export interface ScriptingSessionStartInput {
    teamId: string;
    teamClusterId: string;
    userId: string;
    notebookId: string;
    notebook: ScriptingSessionNotebookInput;
    secretKey?: string;
    trajectoryId?: string | null;
}

interface ScriptingSessionStartResult {
    notebookId: string;
    jupyter: ScriptingSessionJupyter;
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

const NOTEBOOK_SESSION_CREATE_TIMEOUT_MS = 600_000;

class DaemonScriptingSessionOrchestrator {
    private readonly accessTokenService = new ScriptingJupyterAccessTokenService();

    async startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult> {
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

        const response = await teamClusterDaemonClient.command<DaemonNotebookSessionResponse>(
            input.teamClusterId,
            ChannelCommands.NotebookSessionCreate,
            request,
            { timeoutMs: NOTEBOOK_SESSION_CREATE_TIMEOUT_MS }
        );
        await ScriptingNotebook.update(
            { id: input.notebookId },
            {
                runtimeNotebookId,
                teamCluster: input.teamClusterId
            }
        );

        const jupyter = response.jupyter;
        const accessGrant = this.accessTokenService.createAccessGrant({
            teamId: input.teamId,
            runtimeNotebookId,
            userId: input.userId
        });
        const jupyterUrl = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            daemonPath: jupyter.internalPath,
            accessToken: accessGrant.token
        });

        return attachScriptingJupyterAccessGrant({
            notebookId: input.notebookId,
            jupyter: {
                ...jupyter,
                url: jupyterUrl
            }
        }, accessGrant);
    }

    async deleteSession(trajectoryId: string): Promise<void> {
        const notebooks = await ScriptingNotebook.findBy({ trajectory: trajectoryId });

        for (const notebook of notebooks) {
            if (!notebook.runtimeNotebookId || !notebook.teamCluster) {
                continue;
            }

            await notebookRuntimeTerminator.terminate(notebook.teamCluster, notebook.runtimeNotebookId);
        }
    }
}

export default new DaemonScriptingSessionOrchestrator();
