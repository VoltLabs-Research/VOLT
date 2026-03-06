export interface GetContainerFilesInputDTO {
    containerId: string;
    path?: string;
}

export interface GetContainerFilesOutputDTO {
    files: Record<string, unknown>[];
}
