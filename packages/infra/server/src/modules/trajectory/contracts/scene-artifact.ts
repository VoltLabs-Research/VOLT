export interface SceneArtifactMetadata{
    pluginId?: string;
    exposureId?: string;
    exposureName?: string;
    exporter?: string;
    exportType?: string;
    [key: string]: unknown;
}
