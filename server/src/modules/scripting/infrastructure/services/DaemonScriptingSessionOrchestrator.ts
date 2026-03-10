import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import { JupyterNotebookService } from '@modules/scripting/infrastructure/services/JupyterNotebookService';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/infrastructure/services/ScriptingJupyterAccessTokenService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
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

interface DaemonNotebookSessionResponse {
    jupyter?: {
        url: string;
        ready: boolean;
    };
};

const buildServerBaseUrl = (): string => {
    const configuredServerUrl = process.env.SERVER_ENDPOINT?.trim();
    if (configuredServerUrl) {
        return configuredServerUrl.replace(/\/+$/g, '');
    }

    const protocol = process.env.SERVER_SCHEMA?.trim() || 'http';
    const host = process.env.SERVER_HOSTNAME?.trim() || 'localhost';
    return `${protocol}://${host}`;
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

        const runtimeNotebookId = await this.ensureRemoteNotebook(teamClusterId, input.notebookId, input);

        const response = await this.teamClusterDaemonClient.request<DaemonNotebookSessionResponse>(
            teamClusterId,
            `/api/notebooks/${runtimeNotebookId}/sessions`,
            {
                method: 'POST',
                body: {
                    requestedBy: input.userId
                }
            }
        );

        if (response.jupyter) {
            const jupyterUrl = this.buildProxyJupyterUrl(input.teamId, runtimeNotebookId, response.jupyter.url, input.userId);
            return {
                jupyter: response.jupyter
                    ? {
                        ...response.jupyter,
                        url: jupyterUrl
                    }
                    : response.jupyter
            };
        }

        return {
            jupyter: {
                url: '',
                ready: false
            }
        };
    }

    async deleteSession(trajectoryId: string): Promise<void> {
        const notebooks = await this.scriptingNotebookRepository.findAllWithTrajectory(trajectoryId);

        for (const notebook of notebooks) {
            const isOrphaned = notebook.props.trajectories.length <= 1;
            if (!isOrphaned || !notebook.props.runtimeNotebookId || !notebook.props.teamCluster) {
                continue;
            }

            try {
                await this.teamClusterDaemonClient.request(
                    notebook.props.teamCluster,
                    `/api/notebooks/${notebook.props.runtimeNotebookId}`,
                    { method: 'DELETE' }
                );
            } catch (error: unknown) {
                logger.warn(
                    { err: error, notebookId: notebook.id, runtimeNotebookId: notebook.props.runtimeNotebookId, trajectoryId },
                    '[Scripting] Failed to delete orphaned Jupyter session on daemon'
                );
            }
        }
    }

    async resolveDefaultNotebookTemplateContent(context: DefaultNotebookTemplateContext): Promise<string> {
        return this.notebookService.resolveDefaultNotebookTemplateContent(context);
    }

    private async ensureRemoteNotebook(
        teamClusterId: string,
        notebookId: string,
        input: ScriptingSessionStartInput
    ): Promise<string> {
        const notebook = await this.scriptingNotebookRepository.findById(notebookId);
        if (!notebook) {
            throw ApplicationError.notFound('Scripting::NotebookNotFound', 'Notebook not found');
        }

        if (notebook.props.runtimeNotebookId) {
            return notebook.props.runtimeNotebookId;
        }

        const createdNotebook = await this.teamClusterDaemonClient.request<{ _id: string; }>(teamClusterId, '/api/notebooks', {
            method: 'POST',
            body: {
                _id: notebook.id,
                teamId: input.teamId,
                title: notebook.props.title,
                notebookPath: notebook.props.notebookPath,
                trajectories: notebook.props.trajectories,
                createdBy: notebook.props.createdBy,
                content: notebook.props.content
            }
        });

        await this.scriptingNotebookRepository.updateById(notebookId, {
            runtimeNotebookId: notebook.id,
            teamCluster: teamClusterId
        });

        return createdNotebook._id;
    }

    private buildProxyJupyterUrl(teamId: string, runtimeNotebookId: string, daemonUrl: string, userId: string): string {
        const daemonPath = this.extractDaemonPath(daemonUrl);
        const accessToken = this.accessTokenService.create({
            teamId,
            runtimeNotebookId,
            userId
        });
        const serverBaseUrl = buildServerBaseUrl();
        const proxyUrl = new URL(`/api/jupyter/${encodeURIComponent(teamId)}/notebooks/${encodeURIComponent(runtimeNotebookId)}${daemonPath}`, serverBaseUrl);
        proxyUrl.searchParams.set('access_token', accessToken);
        return proxyUrl.toString();
    }

    private extractDaemonPath(daemonUrl: string): string {
        if (!daemonUrl) {
            return '/';
        }

        if (daemonUrl.startsWith('/')) {
            return daemonUrl;
        }

        try {
            const parsedUrl = new URL(daemonUrl);
            const search = parsedUrl.search || '';
            return `${parsedUrl.pathname}${search}`;
        } catch {
            return daemonUrl.startsWith('/') ? daemonUrl : `/${daemonUrl.replace(/^\/+/, '')}`;
        }
    }
};
