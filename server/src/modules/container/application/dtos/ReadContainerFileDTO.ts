export interface ReadContainerFileInputDTO {
    containerId: string;
    path: string;
}

export interface ReadContainerFileOutputDTO {
    content: string;
}
