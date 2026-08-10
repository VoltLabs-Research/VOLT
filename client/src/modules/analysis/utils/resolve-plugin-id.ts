import type { Analysis } from '@volt/contracts/modules/analysis/domain';

/**
 * The plugin id of an analysis, whichever shape the API sent.
 *
 * The contract declares `plugin: string`, but several endpoints return the field
 * populated as the full plugin document. Interpolating that object into a URL is
 * what produced `GET /plugins/[object Object]` 404s on every canvas load.
 */
export const resolveAnalysisPluginId = (analysis: Analysis): string => {
    const plugin = analysis.plugin as string | { _id?: string } | undefined;

    if (typeof plugin === 'string') return plugin;
    return plugin?._id ?? '';
};
