import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';

export const mapPluginToPersistedDTO = (plugin: Plugin): PersistedPluginDTO => {
    return {
        _id: plugin._id,
        ...plugin.props,
        workflow: plugin.props.workflow.props
    };
};
