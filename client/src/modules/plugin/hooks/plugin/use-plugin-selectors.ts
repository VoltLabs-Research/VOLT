import { useMemo, useCallback } from 'react';
import { useAllPluginsQuery } from './queries';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';

export interface RenderableExposure {
    pluginId: string;
    analysisId: string;
    exposureId: string;
    modifierId?: string;
    name: string;
    icon?: string;
    results: string;
    canvas: boolean;
    raster: boolean;
    export?: {
        exporter?: string;
        type?: string;
        options?: Record<string, unknown>;
    };
}

export interface ResolvedModifier {
    plugin: Plugin;
    pluginId: string;
    name: string;
    icon?: string;
};

const buildPluginsById = (plugins: Plugin[]): Record<string, Plugin> => {
    return Object.fromEntries(plugins.map((plugin) => [plugin._id, plugin]));
};

const usePluginSelectors = () => {
    const { data: plugins = [], isLoading } = useAllPluginsQuery({ enabled: false });

    const pluginsById = useMemo(() => buildPluginsById(plugins), [plugins]);

    const modifiers = useMemo((): ResolvedModifier[] => {
        return plugins
            .filter((plugin) => plugin.modifier)
            .map((plugin) => ({
                plugin,
                pluginId: plugin._id,
                name: plugin.modifier?.name || plugin._id,
                icon: plugin.modifier?.icon
            }));
    }, [plugins]);

    const getPluginArguments = useCallback((pluginId: string): IArgumentDefinition[] => {
        const plugin = pluginsById[pluginId];
        return plugin?.arguments ?? [];
    }, [pluginsById]);

    return {
        plugins,
        pluginsById,
        modifiers,
        getPluginArguments,
        isLoading
    };
};

export default usePluginSelectors;
