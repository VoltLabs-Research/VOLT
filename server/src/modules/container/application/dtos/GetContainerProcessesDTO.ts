export interface GetContainerProcessesInputDTO {
    containerId: string;
}

export interface GetContainerProcessesOutputDTO {
    processes: Record<string, unknown>[];
}
