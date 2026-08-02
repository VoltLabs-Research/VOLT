import { ErrorCodes } from '@core/constants/error-codes';
import PluginEntity from '@modules/plugin/models/Plugin';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import {
    WorkflowNodeType,
    type EntrypointNodeData
} from '@modules/plugin/models/plugin/workflow/WorkflowTypes';
import type { Plugin, PluginRecord } from '@modules/plugin/contracts/plugin';
import {
    mapPluginToRecord,
    projectWorkflowColumns,
    requirePlugin,
    requirePluginEntity,
    toPluginLike
} from '@modules/plugin/services/plugin/PluginQueries';
import {
    WorkflowValidationMode,
    WorkflowValidatorService
} from '@modules/plugin/services/plugin/WorkflowValidatorService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import eventBus from '@shared/infrastructure/events/RedisEventBus';
import logger from '@shared/infrastructure/logger';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type { FindOptionsWhere } from 'typeorm';

export interface ListPluginsInput {
    teamId: string;
    page?: number;
    limit?: number;
    status?: PluginStatus;
}

export interface UpdatePluginByIdInput {
    pluginId: string;
    workflow?: WorkflowProps;
    status?: PluginStatus;
    _allowBinaryFieldUpdate?: boolean;
}

const LIST_PLUGINS_DEFAULT_LIMIT = 100;

/**
 * Plugin lifecycle over the `plugins` table: listing, creating drafts, cloning,
 * reading, updating (including the publish transition) and deleting.
 */
export default class PluginCrudService {
    #workflowValidator: WorkflowValidatorService;

    constructor(workflowValidator: WorkflowValidatorService) {
        this.#workflowValidator = workflowValidator;
    }

    async listPlugins(input: ListPluginsInput): Promise<PaginatedResult<PluginRecord>> {
        const where: FindOptionsWhere<PluginEntity> = {
            team: input.teamId,
            ...(input.status ? { status: input.status } : {})
        };
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: LIST_PLUGINS_DEFAULT_LIMIT });

        const [plugins, total] = await PluginEntity.findAndCount({
            where,
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([plugins.map((plugin) => mapPluginToRecord(toPluginLike(plugin))), total], pageRequest);
    }

    async createPlugin(workflowProps: WorkflowProps, teamId: string): Promise<{ plugin: PluginRecord }> {
        const validation = await this.#workflowValidator.validate(workflowProps, undefined, WorkflowValidationMode.Draft);
        if (!validation.isValid) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                `Plugin workflow is invalid: ${(validation.errors ?? []).join(', ')}`
            );
        }

        return { plugin: await this.#createDraft(workflowProps, teamId) };
    }

    async clonePlugin(pluginId: string, teamId: string): Promise<{ plugin: PluginRecord }> {
        const original = await requirePlugin(pluginId);

        const nodes = original.props.workflow.props.nodes.map((node) => {
            if (node.type !== WorkflowNodeType.Modifier || !node.data.modifier) return node;
            return {
                ...node,
                data: {
                    ...node.data,
                    modifier: {
                        ...node.data.modifier,
                        name: `${node.data.modifier.name} (Copy)`
                    }
                }
            };
        });

        return {
            plugin: await this.#createDraft({
                ...original.props.workflow.props,
                nodes
            }, teamId)
        };
    }

    async getPluginById(pluginId: string): Promise<PluginRecord> {
        return mapPluginToRecord(await requirePlugin(pluginId));
    }

    async updatePluginById(input: UpdatePluginByIdInput): Promise<PluginRecord> {
        const plugin = await requirePlugin(input.pluginId);
        const effectiveStatus = input.status ?? plugin.props.status;
        const update: Partial<PluginEntity> = {};

        if (input.status) update.status = input.status;

        if (input.workflow) {
            await this.#assertPublishable(input.workflow, plugin.id, effectiveStatus);

            if (!input._allowBinaryFieldUpdate) {
                this.#carryOverBinaryFields(plugin.props.workflow.entrypoint, input.workflow);
            }

            Object.assign(update, projectWorkflowColumns(new Workflow(plugin._id, input.workflow), plugin._id));
        } else if (input.status === PluginStatus.PUBLISHED) {
            await this.#assertPublishable(plugin.props.workflow.props, plugin.id, PluginStatus.PUBLISHED);
        }

        const updatedPlugin = toPluginLike(
            await Object.assign(await requirePluginEntity(input.pluginId), update).save()
        );

        if (input.status === PluginStatus.PUBLISHED && plugin.props.status !== PluginStatus.PUBLISHED) {
            await this.#emitPublished(updatedPlugin);
        }

        return mapPluginToRecord(updatedPlugin);
    }

    async deletePluginById(pluginId: string): Promise<null> {
        const pluginEntity = await requirePluginEntity(pluginId);
        const plugin = toPluginLike(pluginEntity);

        await pluginEntity.remove();

        await eventBus.emit('plugin.deleted', {
            pluginId: plugin.id,
            teamId: plugin.props.team,
            workflow: plugin.props.workflow
        });

        return null;
    }

    async #createDraft(workflowProps: WorkflowProps, teamId: string): Promise<PluginRecord> {
        const pluginEntity = await PluginEntity.create({
            ...projectWorkflowColumns(new Workflow('', workflowProps), ''),
            team: teamId,
            status: PluginStatus.DRAFT
        }).save();
        const plugin = toPluginLike(pluginEntity);

        await eventBus.emit('plugin.created', {
            pluginId: plugin._id,
            teamId
        });

        return mapPluginToRecord(plugin);
    }

    /**
     * A draft may be saved while still invalid; only publishing enforces the
     * strict rules, so an unpublishable workflow is rejected outright there.
     */
    async #assertPublishable(workflow: WorkflowProps, pluginId: string, status: PluginStatus): Promise<void> {
        const mode = status === PluginStatus.PUBLISHED
            ? WorkflowValidationMode.Strict
            : WorkflowValidationMode.Draft;
        const { isValid, errors } = await this.#workflowValidator.validate(workflow, pluginId, mode);

        if (status === PluginStatus.PUBLISHED && !isValid) {
            throw ApplicationError.badRequest(
                ErrorCodes.PLUGIN_NOT_VALID_CANNOT_PUBLISH,
                `Plugin not valid, cannot publish: ${(errors ?? []).join(', ')}`
            );
        }
    }

    /**
     * Binary fields are owned by the upload endpoints, so a workflow save coming
     * from the editor must not be able to clear or repoint the stored binary.
     */
    #carryOverBinaryFields(current: EntrypointNodeData | undefined, incoming: WorkflowProps): void {
        const incomingNode = incoming.nodes.find((node) => node.type === WorkflowNodeType.Entrypoint);

        if (!current || !incomingNode?.data.entrypoint) {
            return;
        }

        const { binary, binaryObjectPath, binaryFileName, binaryHash } = current;
        incomingNode.data.entrypoint = {
            ...incomingNode.data.entrypoint,
            binary,
            binaryObjectPath,
            binaryFileName,
            binaryHash
        };
    }

    async #emitPublished(plugin: Plugin): Promise<void> {
        const entrypoint = plugin.props.workflow.entrypoint;

        await eventBus.emit('plugin.published', {
            pluginId: plugin.id,
            teamId: plugin.props.team,
            binaryObjectPath: entrypoint?.binaryObjectPath,
            requirementsFile: entrypoint?.requirementsFile,
            entrypointScript: entrypoint?.entrypointScript,
            binaryHash: entrypoint?.binaryHash
        }).catch((error: unknown) => {
            logger.warn({
                err: error,
                pluginId: plugin.id
            }, '@plugin-crud-service: failed to publish plugin.published');
        });
    }
}
