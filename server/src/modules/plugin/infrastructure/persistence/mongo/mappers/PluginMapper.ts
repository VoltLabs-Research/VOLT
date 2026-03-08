import Plugin, { PluginProps } from '@modules/plugin/domain/entities/Plugin';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';
import { PluginDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/PluginModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import WorkflowProjectionService from '@modules/plugin/domain/services/WorkflowProjectionService';

class PluginMapper extends BaseMapper<Plugin, PluginProps, PluginDocument> {
    constructor() {
        super(Plugin, [
            'team'
        ]);
    }

    toDomain(doc: PluginDocument): Plugin {
        const rawProps = doc.toObject({ flattenMaps: true });
        const {
            _id: ignoredId,
            __v: ignoredVersion,
            workflow: workflowProps,
            ...props
        } = rawProps;
        const workflow = new Workflow(doc._id.toString(), workflowProps);
        const projection = WorkflowProjectionService.project(workflow, doc._id.toString());

        const resolvedModifier = props.modifier ?? projection.modifier;
        const resolvedExposures = props.exposures ?? projection.exposures;
        const resolvedArguments = props.arguments ?? projection.arguments;
        const resolvedListingExposures = props.listingExposures ?? projection.listingExposures;

        return new Plugin(doc._id.toString(), {
            ...props,
            workflow,
            modifier: resolvedModifier,
            exposures: resolvedExposures,
            arguments: resolvedArguments,
            listingExposures: resolvedListingExposures
        });
    }

    toPersistence(domainOrProps: Plugin | PluginProps): Partial<PluginDocument> {
        const persistenceData = super.toPersistence(domainOrProps);
        const source = 'props' in (domainOrProps as object)
            ? (domainOrProps as Plugin).props
            : domainOrProps as PluginProps;

        if (!source.workflow) {
            return persistenceData;
        }

        return {
            ...persistenceData,
            workflow: source.workflow.props
        } as unknown as Partial<PluginDocument>;
    }
};

export default new PluginMapper();
