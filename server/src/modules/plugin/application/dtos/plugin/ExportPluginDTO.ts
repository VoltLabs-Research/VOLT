export interface ExportPluginOutputDTO {
    stream: any; // ReadableStream
    fileName: string;
}

export interface ExportPluginInputDTO{
    pluginId: string;
};