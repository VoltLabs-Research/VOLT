/**
 * Pure, neutral helper extracting a plugin id from either a raw id string or a
 * populated plugin record (`{ _id }`). Canonical home in the neutral `shared`
 * layer (detachable-modules migration) so cross-module consumers (dashboard,
 * trajectory canvas use cases) needn't import `@modules/analysis`.
 *
 * Pure function over `unknown` input + a shared type-guard — no `@modules/*`
 * imports. The original `@modules/analysis/utilities/extract-plugin-id`
 * re-exports it for backward compatibility.
 */
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
