import { isRecord } from '@shared/infrastructure/utilities/type-guards';

export const extractPluginId = (pluginValue: unknown): string => {
    if (typeof pluginValue === 'string') {
        return pluginValue;
    }

    if (isRecord(pluginValue) && pluginValue._id != null) {
        return String(pluginValue._id);
    }

    return '';
};
