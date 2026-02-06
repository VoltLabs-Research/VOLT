import Plugin, { PluginProps } from '@modules/plugin/domain/entities/Plugin';
import Workflow from '@modules/plugin/domain/entities/workflow/Workflow';
import { PluginDocument } from '@modules/plugin/infrastructure/persistence/mongo/models/PluginModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class PluginMapper extends BaseMapper<Plugin, PluginProps, PluginDocument> {
    constructor() {
        super(Plugin, [
            'team'
        ]);
    }

    toDomain(doc: PluginDocument): Plugin {
        const props = doc.toObject({ flattenMaps: true });

        const workflow = new Workflow(doc._id.toString(), props.workflow);

        return new Plugin(doc._id.toString(), {
            ...props,
            workflow
        });
    }
};

export default new PluginMapper();