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
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';

interface DaemonNotebookJupyterResponse {
    internalPath?: string;
    path?: string;
    url?: string;
    ready: boolean;
};

interface DaemonNotebookSessionResponse {
    jupyter?: DaemonNotebookJupyterResponse;
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
    notebookId: string;
    requestedBy: string;
    publicBasePath: string;
    notebook: DaemonNotebookSessionSnapshot;
};

const LEGACY_DAEMON_PROXY_BASE_PATH = '/api/notebooks/proxy';

const getNotebookTeamClusterId = (teamCluster: unknown): string | null => {
    if (!teamCluster) {
        return null;
    }

    if (typeof teamCluster === 'string') {
        return teamCluster;
    }

    if (typeof teamCluster === 'object' && teamCluster !== null && '_id' in teamCluster && typeof teamCluster._id === 'string') {
        return teamCluster._id;
    }

    return null;
};

const getNotebookTrajectoryCount = (notebook: { props: ScriptingNotebookProps }): number => {
    if (Array.isArray(notebook.props.trajectories) && notebook.props.trajectories.length > 0) {
        return notebook.props.trajectories.length;
    }

    return notebook.props.trajectory ? 1 : 0;
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
        if (!input.notebook) {
            throw ApplicationError.badRequest('Scripting::NotebookSnapshotRequired', 'Notebook snapshot is required to start a remote notebook session');
        }

        const runtimeNotebookId = input.notebookId;
        const request: DaemonNotebookSessionRequest = {
            notebookId: runtimeNotebookId,
            requestedBy: input.userId,
            publicBasePath: this.buildPublicProxyBasePath(input.teamId, runtimeNotebookId),
            notebook: {
                _id: runtimeNotebookId,
                teamId: input.teamId,
                notebookPath: input.notebook.notebookPath,
                content: input.notebook.content
            }
        };

        const response = await this.teamClusterDaemonClient.command<DaemonNotebookSessionResponse>(
            teamClusterId,
            'notebook.session.create',
            request
        );
        await this.scriptingNotebookRepository.updateById(input.notebookId, {
            runtimeNotebookId,
            teamCluster: teamClusterId
        });

        if (response.jupyter) {
            const daemonPath = this.resolveDaemonJupyterPath(response.jupyter);
            const jupyterUrl = this.buildProxyJupyterUrl(input.teamId, runtimeNotebookId, daemonPath, input.userId);
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
            const isOrphaned = getNotebookTrajectoryCount(notebook) <= 1;
            const notebookTeamClusterId = getNotebookTeamClusterId((notebook.props as unknown as Record<string, unknown>).teamCluster);
            if (!isOrphaned || !notebook.props.runtimeNotebookId || !notebookTeamClusterId) {
                continue;
            }

            try {
                await this.teamClusterDaemonClient.command(
                    notebookTeamClusterId,
                    'notebook.delete',
                    {
                        notebookId: notebook.props.runtimeNotebookId
                    }
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

    private buildProxyJupyterUrl(teamId: string, runtimeNotebookId: string, daemonPath: string, userId: string): string {
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

    private buildPublicProxyBasePath(teamId: string, runtimeNotebookId: string): string {
        return `/api/jupyter/${encodeURIComponent(teamId)}/notebooks/${encodeURIComponent(runtimeNotebookId)}`;
    }

    private resolveDaemonJupyterPath(jupyter: DaemonNotebookJupyterResponse): string {
        if (jupyter.internalPath) {
            return this.normalizeDaemonPath(jupyter.internalPath);
        }

        if (jupyter.path) {
            return this.normalizeDaemonPath(jupyter.path);
        }

        return this.normalizeDaemonPath(jupyter.url || '/');
    }

    private normalizeDaemonPath(value: string): string {
        if (!value) {
            return '/';
        }

        if (value.startsWith('/')) {
            return this.stripLegacyDaemonProxyPrefix(value);
        }

        try {
            const parsedUrl = new URL(value);
            const search = parsedUrl.search || '';
            return `${this.stripLegacyDaemonProxyPrefix(parsedUrl.pathname)}${search}`;
        } catch {
            const normalizedValue = value.startsWith('/') ? value : `/${value.replace(/^\/+/, '')}`;
            return this.stripLegacyDaemonProxyPrefix(normalizedValue);
        }
    }

    private stripLegacyDaemonProxyPrefix(pathname: string): string {
        const normalizedPathname = pathname.startsWith('/') ? pathname : `/${pathname}`;
        if (normalizedPathname === LEGACY_DAEMON_PROXY_BASE_PATH) {
            return '/';
        }

        if (normalizedPathname.startsWith(`${LEGACY_DAEMON_PROXY_BASE_PATH}/`)) {
            return normalizedPathname.slice(LEGACY_DAEMON_PROXY_BASE_PATH.length);
        }

        return normalizedPathname;
    }
};
