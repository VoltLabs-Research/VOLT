import Workflow, { type WorkflowProps } from '@modules/plugin/workflow/Workflow';
import { PluginSchema, PluginStatus } from '@modules/plugin/schemas/plugin/PluginSchema';
import WorkflowProjectionService, { type PluginProjection } from '@modules/plugin/utilities/plugin/WorkflowProjectionService';

import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Model, Document } from 'mongoose';

export { PluginStatus };

export interface PluginProps extends Partial<PluginProjection> {
    team: string;
    workflow: Workflow;
    status: PluginStatus;
    createdAt: Date;
    updatedAt: Date;
}

type PluginRelations = 'team';
export interface PluginDocument extends Persistable<PluginProps, PluginRelations>, Document { };

const PluginModel: Model<PluginDocument> = mongoose.model<PluginDocument>('Plugin', PluginSchema);

const PLUGIN_RELATION_KEYS = [
    'team'
] as const;

export interface Plugin {
    readonly _id: string;
    readonly id: string;
    props: PluginProps;
}

export const toPluginLike = (doc: PluginDocument): Plugin => {
    const rawProps = doc.toObject({ flattenMaps: true }) as Record<string, unknown>;
    const {
        _id,
        __v: _ignoredVersion,
        workflow: workflowProps,
        validated: _ignoredValidated,
        validationErrors: _ignoredValidationErrors,
        ...rest
    } = rawProps;

    for (const key of PLUGIN_RELATION_KEYS) {
        const value = Reflect.get(doc, key);

        if (!value) continue;
        if (doc.populated(key)) continue;

        rest[key] = String(value);
    }

    const id = String(_id);
    const workflow = new Workflow(id, workflowProps as WorkflowProps);
    const projection = WorkflowProjectionService.project(workflow, id);

    const resolvedModifier = (rest.modifier as PluginProjection['modifier'] | undefined) ?? projection.modifier;
    const resolvedExposures = (rest.exposures as PluginProjection['exposures'] | undefined) ?? projection.exposures;
    const resolvedArguments = (rest.arguments as PluginProjection['arguments'] | undefined) ?? projection.arguments;
    const resolvedListingExposures = (rest.listingExposures as PluginProjection['listingExposures'] | undefined) ?? projection.listingExposures;
    const resolvedProducesExposures = (rest.producesExposures as PluginProjection['producesExposures'] | undefined) ?? projection.producesExposures;
    const resolvedRequiresExposures = (rest.requiresExposures as PluginProjection['requiresExposures'] | undefined) ?? projection.requiresExposures;

    return {
        _id: id,
        id,
        props: {
            ...rest,
            workflow,
            modifier: resolvedModifier,
            exposures: resolvedExposures,
            arguments: resolvedArguments,
            listingExposures: resolvedListingExposures,
            producesExposures: resolvedProducesExposures,
            requiresExposures: resolvedRequiresExposures
        } as unknown as PluginProps
    };
};

export default PluginModel;
