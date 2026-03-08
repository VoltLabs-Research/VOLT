import type Plugin from '@modules/plugin/domain/entities/Plugin';
import type { PersistedPluginDTO } from '@modules/plugin/application/dtos/plugin/PersistedPluginDTO';

export const mapPluginToPersistedDTO = (plugin: Plugin): PersistedPluginDTO => {
    return {
        _id: plugin._id,
        ...plugin.props,
        workflow: plugin.props.workflow.props
    };
};
