export interface GetContainerProcessesInputDTO {
    teamId: string;
    containerId: string;
}

export interface GetContainerProcessesOutputDTO {
    processes: Record<string, unknown>[];
}
