export interface ContainerCreatedEventPayload{
    containerId: string;
    teamId: string;
    name: string;
    userId: string;
}

export interface ContainerDeletedEventPayload{
    containerId: string;
    teamId: string;
    userId: string;
    containerName: string;
}

export interface ContainerUpdatedEventPayload{
    containerId: string;
    teamId: string;
    containerName: string;
}
