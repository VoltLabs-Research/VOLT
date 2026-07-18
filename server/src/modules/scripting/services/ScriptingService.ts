import { ErrorCodes } from '@core/constants/error-codes';
import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import type { ScriptingNotebookDocument } from '@modules/scripting/models/ScriptingNotebookModel';
import daemonScriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import type { ScriptingSessionJupyterInfo, ScriptingSessionStartInput } from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import redisScriptingSessionLock from '@modules/scripting/services/RedisScriptingSessionLock';
import type { ScriptingSessionLockLease } from '@modules/scripting/services/RedisScriptingSessionLock';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import NotebookDeletedEvent from '@modules/scripting/events/NotebookDeletedEvent';
import { buildScriptingNotebookPath, DEFAULT_SCRIPTING_NOTEBOOK_TITLE } from '@modules/scripting/utilities/build-scripting-notebook';
import { buildJupyterProxyUrl, findNotebookExposure } from '@modules/scripting/utilities/jupyter-proxy';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import teamClusterExposureRegistryService from '@modules/cluster/services/TeamClusterExposureRegistryService';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import { CLUSTER_POPULATE, TRAJECTORY_POPULATE, USER_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import { container as diContainer } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import pRetry from 'p-retry';

const LOCK_TTL_MS = 90_000;
const LOCK_BUSY_WAIT_ATTEMPTS = 5;
const LOCK_BUSY_WAIT_DELAY_MS = 300;

interface CreateJupyterSessionInput {
    teamId: string;
    trajectoryId?: string;
    userId?: string;
    notebookId?: string;
    teamClusterId?: string;
}

interface CreateNotebookInput {
    teamId: string;
    userId?: string;
    title?: string;
    teamClusterId: string;
}

interface UpdateNotebookInput {
    teamId: string;
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: { cpus: number; memoryMB: number };
}

interface ListNotebooksInput {
    teamId: string;
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
    page?: number;
    limit?: number;
}

interface NotebookIdentityInput {
    teamId: string;
    notebookId: string;
}

interface CreateJupyterSessionResult {
    notebookId: string;
    jupyter: ScriptingSessionJupyterInfo;
}

interface GetSessionStatusResult {
    notebookId: string;
    runtimeNotebookId?: string;
    accessToken?: string;
    jupyter: {
        ready: boolean;
        url: string;
        containerStage?: 'creating' | 'starting' | 'ready';
    };
}

interface DeleteSessionResult {
    notebookId: string;
    deleted: boolean;
    runtimeNotebookId?: string;
}

export interface ScriptingNotebookView {
    _id: string;
    teamCluster?: unknown;
    containerResources?: { cpus: number; memoryMB: number } | null;
    title: string;
    notebookPath: string;
    trajectory?: unknown;
    createdBy?: unknown;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PENDING_JUPYTER_SESSION: CreateJupyterSessionResult = {
    notebookId: '',
    jupyter: {
        url: '',
        ready: false,
        containerStage: 'creating'
    }
};

const resolveRef = (doc: ScriptingNotebookDocument, key: string): unknown => {
    const value = (doc as unknown as { get(path: string): unknown }).get(key);
    if (value === undefined || value === null) {
        return null;
    }
    if (doc.populated(key)) {
        return value;
    }
    return String(value);
};

const getSortTimestamp = (doc: ScriptingNotebookDocument): number =>
    doc.lastOpenedAt?.getTime() ?? doc.updatedAt.getTime();

export default class ScriptingService {
    #orchestrator = daemonScriptingSessionOrchestrator;
    #lock = redisScriptingSessionLock;
    #credential = notebookCredentialService;
    #notebookTemplate = new JupyterNotebookService();
    #terminator = notebookRuntimeTerminator;
    #exposureRegistry = teamClusterExposureRegistryService;
    #accessToken = new ScriptingJupyterAccessTokenService();

    #teamClusterSelectionCache?: ITeamClusterSelectionService;
    get #teamClusterSelection(): ITeamClusterSelectionService {
        return (this.#teamClusterSelectionCache ??= diContainer.resolve<ITeamClusterSelectionService>(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService));
    }

    #eventBusCache?: IEventBus;
    get #eventBus(): IEventBus {
        return (this.#eventBusCache ??= diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus));
    }

    async listNotebooks(input: ListNotebooksInput): Promise<PaginatedResult<ScriptingNotebookView>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(500, input.limit ?? 500));
        const filter: Record<string, unknown> = { team: input.teamId };

        if (input.trajectoryId) {
            filter.trajectory = input.trajectoryId;
        } else if (input.scope === ScriptingNotebookScope.General) {
            filter.$or = [
                { trajectory: null },
                { trajectory: { $exists: false } }
            ];
        } else if (input.scope === ScriptingNotebookScope.Trajectory) {
            filter.trajectory = { $exists: true, $ne: null };
        }

        const [docs, total] = await Promise.all([
            ScriptingNotebookModel.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ updatedAt: -1 })
                .populate(CLUSTER_POPULATE)
                .populate(TRAJECTORY_POPULATE)
                .populate(USER_POPULATE)
                .exec(),
            ScriptingNotebookModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#toView(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async createNotebook(input: CreateNotebookInput): Promise<ScriptingNotebookView> {
        if (!input.userId) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        try {
            const notebookContent = await this.#notebookTemplate.resolveNotebookTemplateContent();
            const teamClusterId = await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, input.teamClusterId);
            const notebook = new ScriptingNotebookModel({
                team: input.teamId,
                teamCluster: teamClusterId,
                title: input.title?.trim() || DEFAULT_SCRIPTING_NOTEBOOK_TITLE,
                notebookPath: buildScriptingNotebookPath(randomUUID()),
                trajectory: null,
                createdBy: input.userId,
                content: notebookContent
            });
            await notebook.save();

            return this.#toView(notebook);
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create notebook', 500);
        }
    }

    async updateNotebook(input: UpdateNotebookInput): Promise<ScriptingNotebookView> {
        try {
            const existing = await ScriptingNotebookModel.findOne({ _id: input.notebookId, team: input.teamId }).exec();
            if (!existing) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook not found');
            }

            const update: Record<string, unknown> = {};
            let resetRuntime = false;

            if (typeof input.title === 'string') {
                const title = input.title.trim();
                if (!title) {
                    throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Notebook title is required');
                }
                update.title = title;
            }

            if (input.teamClusterId) {
                const resolvedTeamClusterId = await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, input.teamClusterId);
                if (String(existing.teamCluster) !== resolvedTeamClusterId) {
                    update.teamCluster = resolvedTeamClusterId;
                    resetRuntime = true;
                }
            }

            if (input.containerResources) {
                const next = { cpus: input.containerResources.cpus, memoryMB: input.containerResources.memoryMB };
                if (existing.containerResources?.cpus !== next.cpus || existing.containerResources?.memoryMB !== next.memoryMB) {
                    update.containerResources = next;
                    resetRuntime = true;
                }
            }

            if (update.title === undefined && update.teamCluster === undefined && update.containerResources === undefined) {
                throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'At least one notebook field must be updated');
            }

            if (resetRuntime) {
                const teamClusterId = existing.teamCluster ? String(existing.teamCluster) : undefined;
                const runtimeNotebookId = existing.runtimeNotebookId;
                if (teamClusterId && runtimeNotebookId) {
                    await this.#terminator.terminate(teamClusterId, runtimeNotebookId);
                }
                update.runtimeNotebookId = undefined;
            }

            const updated = await ScriptingNotebookModel.findByIdAndUpdate(input.notebookId, { $set: update }, { new: true }).exec();
            if (!updated) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook not found');
            }

            return this.#toView(updated);
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update notebook', 500);
        }
    }

    async deleteNotebook(input: NotebookIdentityInput): Promise<null> {
        try {
            const notebook = await ScriptingNotebookModel.findById(input.notebookId).exec();
            if (!notebook) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook not found');
            }

            if (notebook.teamCluster && notebook.runtimeNotebookId) {
                await this.#terminator.terminate(String(notebook.teamCluster), notebook.runtimeNotebookId);
            }

            await this.#credential.revokeSecretKey(notebook);
            await ScriptingNotebookModel.deleteOne({ _id: input.notebookId });

            await this.#eventBus.publish(new NotebookDeletedEvent({
                notebookId: input.notebookId,
                teamId: input.teamId
            }));

            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete notebook', 500);
        }
    }

    async getSessionStatus(input: NotebookIdentityInput & { userId?: string }): Promise<GetSessionStatusResult> {
        if (!input.userId) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        const notebook = await ScriptingNotebookModel.findOne({ _id: input.notebookId, team: input.teamId }).exec();
        if (!notebook) {
            throw ApplicationError.notFound(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found');
        }

        const notebookId = String(notebook._id);
        const runtimeNotebookId = notebook.runtimeNotebookId;

        if (!runtimeNotebookId) {
            return { notebookId, jupyter: { ready: false, url: '', containerStage: 'creating' } };
        }

        const accessToken = this.#accessToken.create({ teamId: input.teamId, runtimeNotebookId, userId: input.userId });
        const url = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            notebookPath: notebook.notebookPath,
            accessToken
        });

        if (!notebook.teamCluster) {
            return { notebookId, runtimeNotebookId, accessToken, jupyter: { ready: false, url, containerStage: 'creating' } };
        }

        const exposures = this.#exposureRegistry.listTeamClusterExposures(String(notebook.teamCluster));
        const match = findNotebookExposure(exposures, runtimeNotebookId);

        return {
            notebookId,
            runtimeNotebookId,
            accessToken,
            jupyter: {
                ready: Boolean(match?.ready),
                url,
                containerStage: match?.ready ? 'ready' : 'starting'
            }
        };
    }

    async deleteSession(input: NotebookIdentityInput): Promise<DeleteSessionResult> {
        const notebook = await ScriptingNotebookModel.findOne({ _id: input.notebookId, team: input.teamId }).exec();
        if (!notebook) {
            throw ApplicationError.notFound(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found');
        }

        const runtimeNotebookId = notebook.runtimeNotebookId;
        const teamClusterId = notebook.teamCluster ? String(notebook.teamCluster) : undefined;

        if (runtimeNotebookId && teamClusterId) {
            await this.#terminator.terminate(teamClusterId, runtimeNotebookId);
        }

        await ScriptingNotebookModel.updateOne({ _id: notebook._id }, { $set: { runtimeNotebookId: undefined } });

        return {
            notebookId: String(notebook._id),
            deleted: Boolean(runtimeNotebookId),
            runtimeNotebookId: runtimeNotebookId || undefined
        };
    }

    async createJupyterSession(input: CreateJupyterSessionInput): Promise<CreateJupyterSessionResult> {
        if (!input.userId) {
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }
        const userId = input.userId;

        const lockKey = this.#buildLockKey(input);
        if (!lockKey) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Trajectory id or notebook id is required');
        }

        let lease: ScriptingSessionLockLease | null = null;
        try {
            lease = await this.#lock.acquire(lockKey, LOCK_TTL_MS);
            if (!lease) {
                const pendingNotebookId = await this.#resolvePendingNotebookId(input);
                return { ...PENDING_JUPYTER_SESSION, notebookId: pendingNotebookId };
            }

            const notebook = await this.#resolveNotebookForSession(input, userId);
            const secretKey = await this.#credential.resolveSecretKey(notebook, userId);
            const sessionInput: ScriptingSessionStartInput = {
                teamId: input.teamId,
                teamClusterId: await this.#resolveNotebookTeamClusterId(notebook, input),
                userId,
                notebookId: String(notebook._id),
                trajectoryId: notebook.trajectory ? String(notebook.trajectory) : null,
                secretKey,
                notebook: {
                    notebookPath: notebook.notebookPath,
                    content: notebook.content
                }
            };
            const session = await this.#orchestrator.startSession(sessionInput);

            return { notebookId: String(notebook._id), jupyter: session.jupyter };
        } catch (error) {
            throw this.#mapError(error);
        } finally {
            await lease?.release();
        }
    }

    async #resolveNotebookForSession(input: CreateJupyterSessionInput, userId: string): Promise<ScriptingNotebookDocument> {
        if (input.notebookId) {
            const notebook = await ScriptingNotebookModel.findOne({ _id: input.notebookId, team: input.teamId }).exec();
            if (!notebook) {
                throw new ApplicationError(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found', 404);
            }

            const set: Record<string, unknown> = { lastOpenedAt: new Date() };
            if (input.trajectoryId) {
                const currentTrajectoryId = notebook.trajectory ? String(notebook.trajectory) : null;
                if (currentTrajectoryId !== input.trajectoryId) {
                    set.trajectory = input.trajectoryId;
                }
            }

            const touched = await ScriptingNotebookModel.findByIdAndUpdate(notebook._id, { $set: set }, { new: true }).exec();
            return touched || notebook;
        }

        if (!input.trajectoryId) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Trajectory id or notebook id is required');
        }

        const existingNotebooks = await ScriptingNotebookModel.find({ trajectory: input.trajectoryId }).exec();
        const existing = this.#selectExistingTrajectoryNotebook(existingNotebooks, input.teamId);

        if (existing) {
            const touched = await ScriptingNotebookModel.findByIdAndUpdate(
                existing._id,
                { $set: { trajectory: input.trajectoryId, lastOpenedAt: new Date() } },
                { new: true }
            ).exec();
            return touched || existing;
        }

        const notebookContent = await this.#orchestrator.resolveNotebookTemplateContent();
        const teamClusterIdInput = this.#requireCreateInputTeamClusterId(input);
        const teamClusterId = await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, teamClusterIdInput);
        const notebook = new ScriptingNotebookModel({
            team: input.teamId,
            teamCluster: teamClusterId,
            title: DEFAULT_SCRIPTING_NOTEBOOK_TITLE,
            notebookPath: buildScriptingNotebookPath(input.trajectoryId),
            trajectory: input.trajectoryId,
            createdBy: userId,
            content: notebookContent,
            lastOpenedAt: new Date()
        });
        await notebook.save();

        return notebook;
    }

    async #resolveNotebookTeamClusterId(notebook: ScriptingNotebookDocument, input: CreateJupyterSessionInput): Promise<string> {
        const notebookTeamClusterId = notebook.teamCluster ? String(notebook.teamCluster) : undefined;
        if (!notebookTeamClusterId) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Notebook deployment cluster is not configured');
        }
        return this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, notebookTeamClusterId);
    }

    #requireCreateInputTeamClusterId(input: CreateJupyterSessionInput): string {
        if (!input.teamClusterId) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Notebook deployment cluster is required');
        }
        return input.teamClusterId;
    }

    #buildLockKey(input: CreateJupyterSessionInput): string | null {
        if (input.trajectoryId) {
            return `lock:jupyter:${input.teamId}:trajectory:${input.trajectoryId}`;
        }
        if (input.notebookId) {
            return `lock:jupyter:${input.teamId}:notebook:${input.notebookId}`;
        }
        return null;
    }

    async #resolvePendingNotebookId(input: CreateJupyterSessionInput): Promise<string> {
        if (input.notebookId) {
            return input.notebookId;
        }
        if (!input.trajectoryId) {
            return '';
        }

        try {
            const trajectoryId = input.trajectoryId;
            return await pRetry(async () => {
                const notebooks = await ScriptingNotebookModel.find({ trajectory: trajectoryId }).exec();
                const existingNotebook = this.#selectExistingTrajectoryNotebook(notebooks, input.teamId);
                if (!existingNotebook) {
                    throw ApplicationError.notFound(ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND, 'Pending notebook not created yet');
                }
                return String(existingNotebook._id);
            }, {
                retries: LOCK_BUSY_WAIT_ATTEMPTS - 1,
                factor: 1,
                minTimeout: LOCK_BUSY_WAIT_DELAY_MS,
                maxTimeout: LOCK_BUSY_WAIT_DELAY_MS,
                shouldRetry: ({ error }) => error instanceof ApplicationError
                    && error.code === ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND
            });
        } catch {
            return '';
        }
    }

    #selectExistingTrajectoryNotebook(notebooks: ScriptingNotebookDocument[], teamId: string): ScriptingNotebookDocument | null {
        const teamNotebooks = notebooks.filter((notebook) => String(notebook.team) === teamId);
        if (!teamNotebooks.length) {
            return null;
        }

        return [...teamNotebooks].sort((left, right) => {
            const timestampDelta = getSortTimestamp(right) - getSortTimestamp(left);
            if (timestampDelta !== 0) {
                return timestampDelta;
            }
            return String(right._id).localeCompare(String(left._id));
        })[0] || null;
    }

    #mapError(error: unknown): ApplicationError {
        if (error instanceof ApplicationError) {
            return error;
        }
        if (error instanceof Error) {
            const isDaemonError = error.message.includes('daemon')
                || error.message.includes('Daemon')
                || error.message.includes('Timed out')
                || error.message.includes('connection was lost');
            const errorCode = isDaemonError ? ErrorCodes.SCRIPTING_DAEMON_UNAVAILABLE : ErrorCodes.SCRIPTING_SESSION_FAILED;
            const statusCode = isDaemonError ? 502 : 500;
            return new ApplicationError(errorCode, error.message, statusCode);
        }
        return new ApplicationError(ErrorCodes.SCRIPTING_SESSION_FAILED, 'Unexpected scripting error', 500);
    }

    #toView(doc: ScriptingNotebookDocument): ScriptingNotebookView {
        return {
            _id: String(doc._id),
            teamCluster: resolveRef(doc, 'teamCluster'),
            containerResources: doc.containerResources
                ? { cpus: doc.containerResources.cpus, memoryMB: doc.containerResources.memoryMB }
                : null,
            title: doc.title,
            notebookPath: doc.notebookPath,
            trajectory: resolveRef(doc, 'trajectory'),
            createdBy: resolveRef(doc, 'createdBy'),
            lastOpenedAt: doc.lastOpenedAt,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }
}
