import { In } from 'typeorm';
import PluginEntity from '@modules/plugin/models/Plugin';
import Workflow from '@modules/plugin/models/plugin/workflow/Workflow';
import type { WorkflowProps } from '@modules/plugin/models/plugin/workflow/Workflow';
import WorkflowProjectionService from '@modules/plugin/services/plugin/WorkflowProjection';
import type { PluginProjection } from '@modules/plugin/services/plugin/WorkflowProjection';
import { mapPluginToRecord as mapPluginToRecordNeutral } from '@shared/application/utilities/mapPluginToRecord';
import type { Plugin, PluginProps, PluginRecord } from '@modules/plugin/contracts/domain/plugin';

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
        } as unknown as PluginProps
    };
};

export const toPluginLike = (plugin: PluginEntity): Plugin => {
    const { _id, workflow, ...rest } = plugin.toJSON();

    return buildPluginLike(String(_id), workflow as WorkflowProps, rest);
};

export const mapPluginToRecord = (plugin: Plugin): PluginRecord =>
    mapPluginToRecordNeutral(plugin) as PluginRecord;

export const findPluginsByIds = async (ids: string[]): Promise<Plugin[]> => {
    if(!ids.length){
        return [];
    }

    const plugins = await PluginEntity.findBy({ id: In(ids) });

    return plugins.map((plugin) => toPluginLike(plugin));
};
