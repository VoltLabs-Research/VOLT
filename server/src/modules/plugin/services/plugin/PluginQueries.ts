import { In } from 'typeorm';
import { ErrorCodes } from '@core/constants/error-codes';
import PluginEntity from '@modules/plugin/models/Plugin';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import WorkflowProjectionService from '@modules/plugin/services/plugin/WorkflowProjection';
import type { PluginProjection } from '@modules/plugin/services/plugin/WorkflowProjection';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { mapPluginToRecord as mapPluginToRecordNeutral } from '@shared/application/utilities/mapPluginToRecord';
import type { Plugin, PluginProps, PluginRecord } from '@modules/plugin/contracts/plugin';

const buildPluginLike = (id: string, workflowProps: WorkflowProps, rest: Record<string, unknown>): Plugin => {
    const workflow = new Workflow(id, workflowProps);
    const projection = WorkflowProjectionService.project(workflow, id);

    return {
        _id: id,
        id,
        props: {
            ...rest,
            workflow,
            modifier: (rest.modifier as PluginProjection['modifier'] | undefined) ?? projection.modifier,
            exposures: (rest.exposures as PluginProjection['exposures'] | undefined) ?? projection.exposures,
            arguments: (rest.arguments as PluginProjection['arguments'] | undefined) ?? projection.arguments,
            listingExposures: (rest.listingExposures as PluginProjection['listingExposures'] | undefined) ?? projection.listingExposures,
            producesExposures: (rest.producesExposures as PluginProjection['producesExposures'] | undefined) ?? projection.producesExposures,
            requiresExposures: (rest.requiresExposures as PluginProjection['requiresExposures'] | undefined) ?? projection.requiresExposures
        } as PluginProps
    };
};

export const toPluginLike = (plugin: PluginEntity): Plugin => {
    const { _id, workflow, ...rest } = plugin.toJSON();

    return buildPluginLike(String(_id), workflow as WorkflowProps, rest);
};

export const mapPluginToRecord = (plugin: Plugin): PluginRecord =>
    mapPluginToRecordNeutral(plugin) as PluginRecord;

/**
 * The workflow graph and the columns projected from it are always written
 * together: persisting one without the other leaves the plugin inconsistent.
 */
export const projectWorkflowColumns = (workflow: Workflow, pluginId: string) => {
    const projection = WorkflowProjectionService.project(workflow, pluginId);

    return {
        workflow: workflow.props,
        modifier: projection.modifier,
        exposures: projection.exposures,
        arguments: projection.arguments,
        listingExposures: projection.listingExposures
    };
};

/**
 * Every plugin operation begins by loading the aggregate or 404-ing, so the
 * lookup lives here instead of being restated at each call site.
 */
export const requirePluginEntity = async (pluginId: string): Promise<PluginEntity> => {
    const pluginEntity = await PluginEntity.findOneBy({ id: pluginId });

    if(!pluginEntity){
        throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');
    }

    return pluginEntity;
};

export const requirePlugin = async (pluginId: string): Promise<Plugin> => {
    return toPluginLike(await requirePluginEntity(pluginId));
};

export const persistProjectedWorkflow = async (pluginId: string, workflow: Workflow): Promise<Plugin> => {
    const pluginEntity = await requirePluginEntity(pluginId);

    return toPluginLike(await Object.assign(pluginEntity, projectWorkflowColumns(workflow, pluginId)).save());
};

export const findPluginsByIds = async (ids: string[]): Promise<Plugin[]> => {
    if(!ids.length){
        return [];
    }

    const plugins = await PluginEntity.findBy({ id: In(ids) });

    return plugins.map((plugin) => toPluginLike(plugin));
};
