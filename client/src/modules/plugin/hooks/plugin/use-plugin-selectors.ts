import { useMemo, useCallback } from 'react';
import { usePluginCatalogQuery } from './catalog-query';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import { PluginStatus } from '@volt/contracts/modules/plugin/enums';
import type { IArgumentDefinition } from '@volt/contracts/modules/plugin/workflow';
import type { SelectOption } from '@voltstack/bravais';

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

interface ResolvedModifier {
    plugin: Plugin;
    pluginId: string;
    name: string;
}

const buildPluginsById = (plugins: Plugin[]): Record<string, Plugin> => {
    return Object.fromEntries(plugins.map((plugin) => [plugin._id, plugin]));
};

/** How a plugin is labelled anywhere the user picks one from a list. */
export const toPluginSelectOption = (plugin: Plugin): SelectOption => ({
    value: plugin._id,
    title: plugin.modifier?.name?.trim() || plugin._id
});

const usePluginSelectors = () => {
    const { data: plugins = [], isLoading } = usePluginCatalogQuery({ enabled: true });

    const pluginsById = useMemo(() => buildPluginsById(plugins), [plugins]);

    const publishedPlugins = useMemo(() => {
        return plugins.filter((plugin) => plugin.status === PluginStatus.PUBLISHED);
    }, [plugins]);

    const publishedPluginsById = useMemo(() => buildPluginsById(publishedPlugins), [publishedPlugins]);

    const publishedPluginOptions = useMemo(() => publishedPlugins.map(toPluginSelectOption), [publishedPlugins]);

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
        publishedPluginOptions,
        modifiers,
        getPluginArguments,
        isLoading
    };
};

export default usePluginSelectors;
