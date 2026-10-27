import type { ScriptingSessionJupyter } from '@volt/contracts/modules/scripting/domain';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import { attachScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import type { ScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import { buildJupyterProxyBasePath, buildJupyterProxyUrl } from '@modules/scripting/services/ScriptingJupyterProxySupport';
import { resolveServerBaseUrl } from '@shared/utilities/server-url';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import type {
    CreateNotebookSessionRequest,
    CreateNotebookSessionResponse
} from '@volt/contracts/modules/scripting/daemon';

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

const NOTEBOOK_SESSION_CREATE_TIMEOUT_MS = 600_000;

class DaemonScriptingSessionOrchestrator {
    private readonly accessTokenService = new ScriptingJupyterAccessTokenService();

    async startSession(input: ScriptingSessionStartInput): Promise<ScriptingSessionStartResult> {
        const runtimeNotebookId = input.notebookId;
        const request: CreateNotebookSessionRequest = {
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

        const response = await teamClusterDaemonClient.command<CreateNotebookSessionResponse>(
            input.teamClusterId,
            DaemonCommand.NotebookSessionCreate,
            request,
            { timeoutMs: NOTEBOOK_SESSION_CREATE_TIMEOUT_MS }
        );
        const notebook = await ScriptingNotebook.findOneByOrFail({ id: input.notebookId });
        notebook.runtimeNotebookId = runtimeNotebookId;
        notebook.teamCluster = input.teamClusterId;
        if (response.content) {
            // What JupyterLab saved in the notebook's container is newer than the stored copy.
            notebook.content = response.content as unknown as ScriptingNotebook['content'];
        }
        await notebook.save();

        const jupyter = response.jupyter;
        const accessGrant = await this.accessTokenService.createAccessGrant({
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
