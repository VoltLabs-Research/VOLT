export interface BinaryCacheRequest{
    pluginSlug: string;
    binaryHash: string;
    binaryFileName?: string;
    binaryObjectPath: string;
};

export interface IPluginBinaryCacheService{
    /**
     * Ensures the binary exists locally, is executable, and verifies its integrity.
     * Handles concurrent requests for the same binary (request coalescing).
     * @returns The absolute local file path to the executable binary.
     */
    getBinaryPath(request: BinaryCacheRequest): Promise<string>;
};