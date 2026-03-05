export interface BinaryCacheRequest{
    pluginId: string;
    binaryObjectPath: string;
    binaryFileName?: string;
};

export interface IPluginBinaryCacheService{
    /**
     * Ensures the binary exists locally and is executable.
     * Handles concurrent requests for the same binary (request coalescing).
     * @returns The absolute local file path to the executable binary.
     */
    getBinaryPath(request: BinaryCacheRequest): Promise<string>;

    /**
     * Removes all cached binary files associated with a given plugin.
     * Should be called when a plugin binary is deleted, re-uploaded, or the plugin itself is removed.
     */
    evictByPluginId(pluginId: string): Promise<void>;
};