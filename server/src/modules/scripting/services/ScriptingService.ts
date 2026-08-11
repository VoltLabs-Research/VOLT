import eventBus from '@shared/infrastructure/events/PostgresEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import notebookCredentialService from '@modules/scripting/services/NotebookCredentialService';
import { JupyterNotebookService } from '@modules/scripting/services/JupyterNotebookService';
import notebookRuntimeTerminator from '@modules/scripting/services/NotebookRuntimeTerminator';
import { buildScriptingNotebookPath, DEFAULT_SCRIPTING_NOTEBOOK_TITLE } from '@modules/scripting/services/scripting-notebook-defaults';
import { toScriptingNotebookView } from '@modules/scripting/services/scripting-notebook-view';
import type { NotebookIdentityInput, ScriptingNotebookView } from '@modules/scripting/contracts/scripting-notebook';
import { ScriptingNotebookScope } from '@volt/contracts/modules/scripting/domain';
import type { ScriptingNotebookContainerResources } from '@volt/contracts/modules/scripting/domain';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import { IsNull, Not } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { randomUUID } from 'node:crypto';

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

interface CreateNotebookInput{
    teamId: string;
    userId: string;
    title?: string;
    teamClusterId: string;
}

interface UpdateNotebookInput{
    teamId: string;
    notebookId: string;
    title?: string;
    teamClusterId?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

interface ListNotebooksInput{
    teamId: string;
    trajectoryId?: string;
    scope?: ScriptingNotebookScope;
    page?: number;
    limit?: number;
}

interface UpdateNotebookPatch{
    title?: string;
    teamCluster?: string;
    containerResources?: ScriptingNotebookContainerResources;
}

const requireContainerResources = (resources: ScriptingNotebookContainerResources) => {
    if(!(resources.cpus >= MIN_CONTAINER_CPUS)){
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Notebook container cpus must be at least ${MIN_CONTAINER_CPUS}`);
    }
    if(!(resources.memoryMB >= MIN_CONTAINER_MEMORY_MB)){
        throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Notebook container memory must be at least ${MIN_CONTAINER_MEMORY_MB} MB`);
    }
};

export default class ScriptingService{
    #credential = notebookCredentialService;
    #notebookTemplate = new JupyterNotebookService();
    #terminator = notebookRuntimeTerminator;

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

        return paginate([notebooks.map(toScriptingNotebookView), total], pageRequest);
    }

    async createNotebook(input: CreateNotebookInput): Promise<ScriptingNotebookView>{
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

        return toScriptingNotebookView(notebook);
    }

    async updateNotebook(input: UpdateNotebookInput): Promise<ScriptingNotebookView>{
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
            const next = input.containerResources;
            requireContainerResources(next);
            if(existing.containerResources?.cpus !== next.cpus || existing.containerResources?.memoryMB !== next.memoryMB){
                patch.containerResources = next;
                resetRuntime = true;
            }
        }

        if(patch.title === undefined && patch.teamCluster === undefined && patch.containerResources === undefined){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'At least one notebook field must be updated');
        }

        if(resetRuntime && existing.teamCluster && existing.runtimeNotebookId){
            await this.#terminator.terminate(existing.teamCluster, existing.runtimeNotebookId);
        }

        const updated = await Object.assign(existing, patch).save();

        return toScriptingNotebookView(updated);
    }

    async deleteNotebook(input: NotebookIdentityInput): Promise<null>{
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
    }
}
