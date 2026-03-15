import { isRecord } from '@shared/infrastructure/utilities/type-guards';

export const extractPluginId = (pluginValue: unknown): string => {
    let pluginId = '';

    if (typeof pluginValue === 'string') {
        pluginId = pluginValue;
    } else if (isRecord(pluginValue) && pluginValue._id != null) {
        pluginId = String(pluginValue._id);
    }

    return pluginId;
};
