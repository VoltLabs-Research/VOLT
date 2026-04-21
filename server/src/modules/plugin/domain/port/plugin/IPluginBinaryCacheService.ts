export interface IPluginBinaryCacheService{
    /**
     * Removes all cached binary files associated with a given plugin.
     * Should be called when a plugin binary is deleted, re-uploaded, or the plugin itself is removed.
     */
    evictByPluginId(pluginId: string): Promise<void>;
};
