import { useMemo, useCallback } from 'react';
import { useAllPluginsQuery } from './queries';
import type { Plugin } from '@/modules/plugin/api/entities/plugin/plugin';
import { PluginStatus } from '@/modules/plugin/api/entities/plugin/workflow-enums';
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
}

const buildPluginsById = (plugins: Plugin[]): Record<string, Plugin> => {
    return Object.fromEntries(plugins.map((plugin) => [plugin._id, plugin]));
};

const usePluginSelectors = () => {
    const { data: plugins = [], isLoading } = useAllPluginsQuery({ enabled: true });

    const pluginsById = useMemo(() => buildPluginsById(plugins), [plugins]);

    const publishedPlugins = useMemo(() => {
        return plugins.filter((plugin) => plugin.status === PluginStatus.PUBLISHED);
    }, [plugins]);

    const publishedPluginsById = useMemo(() => buildPluginsById(publishedPlugins), [publishedPlugins]);

    const modifiers = useMemo((): ResolvedModifier[] => {
        return publishedPlugins
            .filter((plugin) => plugin.modifier)
            .map((plugin) => ({
                plugin,
                pluginId: plugin._id,
                name: plugin.modifier?.name || plugin._id
            }));
    }, [publishedPlugins]);

    const getPluginArguments = useCallback((pluginId: string): IArgumentDefinition[] => {
        const plugin = pluginsById[pluginId];
        return plugin?.arguments ?? [];
    }, [pluginsById]);

    return {
        plugins,
        pluginsById,
        publishedPlugins,
        publishedPluginsById,
        modifiers,
        getPluginArguments,
        isLoading
    };
};

export default usePluginSelectors;
