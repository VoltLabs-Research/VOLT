import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import daemonScriptingSessionOrchestrator from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import type { ScriptingSessionJupyterInfo, ScriptingSessionStartInput } from '@modules/scripting/services/DaemonScriptingSessionOrchestrator';
import redisScriptingSessionLock from '@modules/scripting/services/RedisScriptingSessionLock';
import type { ScriptingSessionLockLease } from '@modules/scripting/services/RedisScriptingSessionLock';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import { ScriptingJupyterAccessTokenService } from '@modules/scripting/services/ScriptingJupyterAccessTokenService';
import { attachScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import type { ScriptingJupyterAccessGrant } from '@modules/scripting/services/ScriptingJupyterAccessGrant';
import { buildJupyterProxyUrl, findNotebookExposure } from '@modules/scripting/services/ScriptingJupyterProxySupport';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import type { ScriptingNotebookContainerResources } from '@volt/contracts/modules/scripting/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import teamClusterExposureRegistryService from '@modules/cluster/services/TeamClusterExposureRegistryService';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { IsNull, Not } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { randomUUID } from 'node:crypto';
import pRetry from 'p-retry';

const DEFAULT_SCRIPTING_NOTEBOOK_TITLE = 'Untitled Notebook';

const buildScriptingNotebookPath = (suffix: string): string => {
    return `scripting-notebook-${suffix}.ipynb`;
};

const LOCK_TTL_MS = 90_000;
const LOCK_BUSY_WAIT_ATTEMPTS = 5;
const LOCK_BUSY_WAIT_DELAY_MS = 300;

const DEFAULT_LIST_LIMIT = 500;

const MIN_CONTAINER_CPUS = 0.5;
const MIN_CONTAINER_MEMORY_MB = 128;

const TEAM_CLUSTER_SELECTION = {
    id: true,
    name: true
} as const;

const TRAJECTORY_SELECTION = {
    id: true,
    name: true
} as const;

const CREATED_BY_SELECTION = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true
} as const;

interface CreateJupyterSessionInput{
    teamId: string;
    trajectoryId?: string;
    userId?: string;
    notebookId?: string;
    teamClusterId?: string;
}

interface CreateNotebookInput{
    teamId: string;
    userId?: string;
    title?: string;
    teamClusterId: string;
}

interface UpdateNotebookInput{
    teamId: string;
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: { cpus: number; memoryMB: number };
}

interface ListNotebooksInput{
    teamId: string;
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
    page?: number;
    limit?: number;
}

interface NotebookIdentityInput{
    teamId: string;
    notebookId: string;
}

interface CreateJupyterSessionResult{
    notebookId: string;
    jupyter: ScriptingSessionJupyterInfo;
    accessGrant?: ScriptingJupyterAccessGrant;
}

interface GetSessionStatusResult{
    notebookId: string;
    jupyter: {
        ready: boolean;
        url: string;
        containerStage?: 'creating' | 'starting' | 'ready';
    };
    accessGrant?: ScriptingJupyterAccessGrant;
}

interface DeleteSessionResult{
    notebookId: string;
    deleted: boolean;
    runtimeNotebookId?: string;
}

interface ScriptingNotebookView{
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

interface UpdateNotebookPatch{
    title?: string;
    teamCluster?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

interface TouchNotebookPatch{
    lastOpenedAt: Date;
    trajectory?: string;
}

const PENDING_JUPYTER_SESSION: CreateJupyterSessionResult = {
    notebookId: '',
    jupyter: {
        url: '',
        ready: false,
        containerStage: 'creating'
    }
};

const resolveRef = (id: string | null | undefined, relation: object | null | undefined): unknown => {
    if(id === undefined || id === null){
        return null;
    }

    return relation ?? id;
};

const getSortTimestamp = (notebook: ScriptingNotebook): number =>
    notebook.lastOpenedAt?.getTime() ?? notebook.updatedAt.getTime();

const requireContainerResources = (resources: { cpus: number; memoryMB: number }): ScriptingNotebookContainerResources => {
    if(!(resources.cpus >= MIN_CONTAINER_CPUS)){
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Notebook container cpus must be at least ${MIN_CONTAINER_CPUS}`);
    }
    if(!(resources.memoryMB >= MIN_CONTAINER_MEMORY_MB)){
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Notebook container memory must be at least ${MIN_CONTAINER_MEMORY_MB} MB`);
    }

    return {
        cpus: resources.cpus,
        memoryMB: resources.memoryMB
    };
};

export default class ScriptingService{
    #orchestrator = daemonScriptingSessionOrchestrator;
    #lock = redisScriptingSessionLock;
    #credential = notebookCredentialService;
    #notebookTemplate = new JupyterNotebookService();
    #terminator = notebookRuntimeTerminator;
    #exposureRegistry = teamClusterExposureRegistryService;
    #accessToken = new ScriptingJupyterAccessTokenService();

    #teamClusterSelection: ITeamClusterSelectionService = teamClusterSelectionService;

    #eventBus = eventBus;

    async listNotebooks(input: ListNotebooksInput): Promise<PaginatedResult<ScriptingNotebookView>>{
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: DEFAULT_LIST_LIMIT });
        const where: FindOptionsWhere<ScriptingNotebook> = { team: input.teamId };

        if(input.trajectoryId){
            where.trajectory = input.trajectoryId;
        }else if(input.scope === ScriptingNotebookScope.General){
            where.trajectory = IsNull();
        }else if(input.scope === ScriptingNotebookScope.Trajectory){
            where.trajectory = Not(IsNull());
        }

        const [notebooks, total] = await ScriptingNotebook.findAndCount({
            where,
            relations: {
                teamClusterRef: true,
                trajectoryRef: true,
                createdByRef: true
            },
            select: {
                teamClusterRef: TEAM_CLUSTER_SELECTION,
                trajectoryRef: TRAJECTORY_SELECTION,
                createdByRef: CREATED_BY_SELECTION
            },
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([notebooks.map((notebook) => this.#toView(notebook)), total], pageRequest);
    }

    async createNotebook(input: CreateNotebookInput): Promise<ScriptingNotebookView>{
        if(!input.userId){
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        try{
            const notebookContent = await this.#notebookTemplate.resolveNotebookTemplateContent();
            const teamClusterId = await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, input.teamClusterId);
            const notebook = await ScriptingNotebook.create({
                team: input.teamId,
                teamCluster: teamClusterId,
                title: input.title?.trim() || DEFAULT_SCRIPTING_NOTEBOOK_TITLE,
                notebookPath: buildScriptingNotebookPath(randomUUID()),
                trajectory: null,
                createdBy: input.userId,
                content: notebookContent
            }).save();

            return this.#toView(notebook);
        }catch(error){
            if(error instanceof ApplicationError){
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to create notebook', 500);
        }
    }

    async updateNotebook(input: UpdateNotebookInput): Promise<ScriptingNotebookView>{
        try{
            const existing = await ScriptingNotebook.findOneBy({
                id: input.notebookId,
                team: input.teamId
            });
            if(!existing){
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook not found');
            }

            const patch: UpdateNotebookPatch = {};
            let resetRuntime = false;

            if(input.title !== undefined){
                const title = input.title.trim();
                if(!title){
                    throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Notebook title is required');
                }
                patch.title = title;
            }

            if(input.teamClusterId){
                const resolvedTeamClusterId = await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, input.teamClusterId);
                if(existing.teamCluster !== resolvedTeamClusterId){
                    patch.teamCluster = resolvedTeamClusterId;
                    resetRuntime = true;
                }
            }

            if(input.containerResources){
                const next = requireContainerResources(input.containerResources);
                if(existing.containerResources?.cpus !== next.cpus || existing.containerResources?.memoryMB !== next.memoryMB){
                    patch.containerResources = next;
                    resetRuntime = true;
                }
            }

            if(patch.title === undefined && patch.teamCluster === undefined && patch.containerResources === undefined){
                throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'At least one notebook field must be updated');
            }

            if(resetRuntime){
                const teamClusterId = existing.teamCluster || undefined;
                const runtimeNotebookId = existing.runtimeNotebookId;
                if(teamClusterId && runtimeNotebookId){
                    await this.#terminator.terminate(teamClusterId, runtimeNotebookId);
                }
            }

            const updated = await Object.assign(existing, patch).save();

            return this.#toView(updated);
        }catch(error){
            if(error instanceof ApplicationError){
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to update notebook', 500);
        }
    }

    async deleteNotebook(input: NotebookIdentityInput): Promise<null>{
        try{
            const notebook = await ScriptingNotebook.findOneBy({ id: input.notebookId });
            if(!notebook){
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Notebook not found');
            }

            if(notebook.teamCluster && notebook.runtimeNotebookId){
                await this.#terminator.terminate(notebook.teamCluster, notebook.runtimeNotebookId);
            }

            await this.#credential.revokeSecretKey(notebook);
            await ScriptingNotebook.delete({ id: input.notebookId });

            await this.#eventBus.emit('notebook.deleted', {
                notebookId: input.notebookId,
                teamId: input.teamId
            });

            return null;
        }catch(error){
            if(error instanceof ApplicationError){
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete notebook', 500);
        }
    }

    async getSessionStatus(input: NotebookIdentityInput & { userId?: string }): Promise<GetSessionStatusResult>{
        if(!input.userId){
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }

        const notebook = await ScriptingNotebook.findOneBy({
            id: input.notebookId,
            team: input.teamId
        });
        if(!notebook){
            throw ApplicationError.notFound(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found');
        }

        const notebookId = notebook.id;
        const runtimeNotebookId = notebook.runtimeNotebookId;

        if(!runtimeNotebookId){
            return {
                notebookId,
                jupyter: {
                    ready: false,
                    url: '',
                    containerStage: 'creating'
                }
            };
        }

        const accessGrant = this.#accessToken.createAccessGrant({
            teamId: input.teamId,
            runtimeNotebookId,
            userId: input.userId
        });
        const url = buildJupyterProxyUrl({
            teamId: input.teamId,
            runtimeNotebookId,
            notebookPath: notebook.notebookPath,
            accessToken: accessGrant.token
        });

        if(!notebook.teamCluster){
            return attachScriptingJupyterAccessGrant({
                notebookId,
                jupyter: {
                    ready: false,
                    url,
                    containerStage: 'creating'
                }
            }, accessGrant);
        }

        const exposures = this.#exposureRegistry.listTeamClusterExposures(notebook.teamCluster);
        const match = findNotebookExposure(exposures, runtimeNotebookId);

        return attachScriptingJupyterAccessGrant({
            notebookId,
            jupyter: {
                ready: Boolean(match?.ready),
                url,
                containerStage: match?.ready ? 'ready' : 'starting'
            }
        }, accessGrant);
    }

    async deleteSession(input: NotebookIdentityInput): Promise<DeleteSessionResult>{
        const notebook = await ScriptingNotebook.findOneBy({
            id: input.notebookId,
            team: input.teamId
        });
        if(!notebook){
            throw ApplicationError.notFound(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found');
        }

        const runtimeNotebookId = notebook.runtimeNotebookId;
        const teamClusterId = notebook.teamCluster || undefined;

        if(runtimeNotebookId && teamClusterId){
            await this.#terminator.terminate(teamClusterId, runtimeNotebookId);
        }

        return {
            notebookId: notebook.id,
            deleted: Boolean(runtimeNotebookId),
            runtimeNotebookId: runtimeNotebookId || undefined
        };
    }

    async createJupyterSession(input: CreateJupyterSessionInput): Promise<CreateJupyterSessionResult>{
        if(!input.userId){
            throw ApplicationError.unauthorized(ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
        }
        const userId = input.userId;

        const lockKey = this.#buildLockKey(input);
        if(!lockKey){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Trajectory id or notebook id is required');
        }

        let lease: ScriptingSessionLockLease | null = null;
        try{
            lease = await this.#lock.acquire(lockKey, LOCK_TTL_MS);
            if(!lease){
                const pendingNotebookId = await this.#resolvePendingNotebookId(input);
                return {
                    ...PENDING_JUPYTER_SESSION,
                    notebookId: pendingNotebookId
                };
            }

            const notebook = await this.#resolveNotebookForSession(input, userId);
            const secretKey = await this.#credential.resolveSecretKey(notebook, userId);
            const sessionInput: ScriptingSessionStartInput = {
                teamId: input.teamId,
                teamClusterId: await this.#resolveNotebookTeamClusterId(notebook, input),
                userId,
                notebookId: notebook.id,
                trajectoryId: notebook.trajectory,
                secretKey,
                notebook: {
                    notebookPath: notebook.notebookPath,
                    content: notebook.content
                }
            };
            const session = await this.#orchestrator.startSession(sessionInput);

            return attachScriptingJupyterAccessGrant({
                notebookId: notebook.id,
                jupyter: session.jupyter
            }, session.accessGrant);
        }catch(error){
            throw this.#mapError(error);
        }finally{
            await lease?.release();
        }
    }

    async #resolveNotebookForSession(input: CreateJupyterSessionInput, userId: string): Promise<ScriptingNotebook>{
        if(input.notebookId){
            const notebook = await ScriptingNotebook.findOneBy({
                id: input.notebookId,
                team: input.teamId
            });
            if(!notebook){
                throw new ApplicationError(ErrorCodes.SCRIPTING_NOTEBOOK_NOT_FOUND, 'Notebook not found', 404);
            }

            const patch: TouchNotebookPatch = { lastOpenedAt: new Date() };
            if(input.trajectoryId && notebook.trajectory !== input.trajectoryId){
                patch.trajectory = input.trajectoryId;
            }

            return Object.assign(notebook, patch).save();
        }

        if(!input.trajectoryId){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Trajectory id or notebook id is required');
        }

        const existingNotebooks = await ScriptingNotebook.findBy({ trajectory: input.trajectoryId });
        const existing = this.#selectExistingTrajectoryNotebook(existingNotebooks, input.teamId);

        if(existing){
            return Object.assign(existing, {
                trajectory: input.trajectoryId,
                lastOpenedAt: new Date()
            }).save();
        }

        const notebookContent = await this.#orchestrator.resolveNotebookTemplateContent();
        const teamClusterIdInput = this.#requireCreateInputTeamClusterId(input);
        const teamClusterId = await this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, teamClusterIdInput);

        return ScriptingNotebook.create({
            team: input.teamId,
            teamCluster: teamClusterId,
            title: DEFAULT_SCRIPTING_NOTEBOOK_TITLE,
            notebookPath: buildScriptingNotebookPath(input.trajectoryId),
            trajectory: input.trajectoryId,
            createdBy: userId,
            content: notebookContent,
            lastOpenedAt: new Date()
        }).save();
    }

    async #resolveNotebookTeamClusterId(notebook: ScriptingNotebook, input: CreateJupyterSessionInput): Promise<string>{
        const notebookTeamClusterId = notebook.teamCluster || undefined;
        if(!notebookTeamClusterId){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Notebook deployment cluster is not configured');
        }

        return this.#teamClusterSelection.resolveConnectedClusterId(input.teamId, notebookTeamClusterId);
    }

    #requireCreateInputTeamClusterId(input: CreateJupyterSessionInput): string{
        if(!input.teamClusterId){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_MISSING_REQUIRED_FIELDS, 'Notebook deployment cluster is required');
        }

        return input.teamClusterId;
    }

    #buildLockKey(input: CreateJupyterSessionInput): string | null{
        if(input.trajectoryId){
            return `lock:jupyter:${input.teamId}:trajectory:${input.trajectoryId}`;
        }
        if(input.notebookId){
            return `lock:jupyter:${input.teamId}:notebook:${input.notebookId}`;
        }

        return null;
    }

    async #resolvePendingNotebookId(input: CreateJupyterSessionInput): Promise<string>{
        if(input.notebookId){
            return input.notebookId;
        }
        if(!input.trajectoryId){
            return '';
        }

        try{
            const trajectoryId = input.trajectoryId;
            return await pRetry(async () => {
                const notebooks = await ScriptingNotebook.findBy({ trajectory: trajectoryId });
                const existingNotebook = this.#selectExistingTrajectoryNotebook(notebooks, input.teamId);
                if(!existingNotebook){
                    throw ApplicationError.notFound(ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND, 'Pending notebook not created yet');
                }

                return existingNotebook.id;
            }, {
                retries: LOCK_BUSY_WAIT_ATTEMPTS - 1,
                factor: 1,
                minTimeout: LOCK_BUSY_WAIT_DELAY_MS,
                maxTimeout: LOCK_BUSY_WAIT_DELAY_MS,
                shouldRetry: ({ error }) => error instanceof ApplicationError
                    && error.code === ErrorCodes.SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND
            });
        }catch{
            return '';
        }
    }

    #selectExistingTrajectoryNotebook(notebooks: ScriptingNotebook[], teamId: string): ScriptingNotebook | null{
        const teamNotebooks = notebooks.filter((notebook) => notebook.team === teamId);
        if(!teamNotebooks.length){
            return null;
        }

        return [...teamNotebooks].sort((left, right) => {
            const timestampDelta = getSortTimestamp(right) - getSortTimestamp(left);
            if(timestampDelta !== 0){
                return timestampDelta;
            }

            return right.id.localeCompare(left.id);
        })[0] || null;
    }

    #mapError(error: unknown): ApplicationError{
        if(error instanceof ApplicationError){
            return error;
        }
        if(error instanceof Error){
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

    #toView(notebook: ScriptingNotebook): ScriptingNotebookView{
        return {
            _id: notebook.id,
            teamCluster: resolveRef(notebook.teamCluster, notebook.teamClusterRef),
            containerResources: notebook.containerResources
                ? {
                    cpus: notebook.containerResources.cpus,
                    memoryMB: notebook.containerResources.memoryMB
                }
                : null,
            title: notebook.title,
            notebookPath: notebook.notebookPath,
            trajectory: resolveRef(notebook.trajectory, notebook.trajectoryRef),
            createdBy: resolveRef(notebook.createdBy, notebook.createdByRef),
            lastOpenedAt: notebook.lastOpenedAt ?? undefined,
            createdAt: notebook.createdAt,
            updatedAt: notebook.updatedAt
        };
    }
}
