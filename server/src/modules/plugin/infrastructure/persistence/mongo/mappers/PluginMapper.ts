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
        const props = doc.toObject({ flattenMaps: true });
        const workflow = new Workflow(doc._id.toString(), props.workflow);
        const projection = WorkflowProjectionService.project(workflow, doc._id.toString());

        return new Plugin(doc._id.toString(), {
            ...props,
            workflow,
            ...projection
        });
    }
};

export default new PluginMapper();
