import type { Analysis } from '@volt/contracts/modules/analysis/domain';

export const resolveAnalysisPluginId = (analysis: Analysis): string => {
    const plugin = analysis.plugin as string | { _id?: string } | undefined;

    if (typeof plugin === 'string') return plugin;
    return plugin?._id ?? '';
};
