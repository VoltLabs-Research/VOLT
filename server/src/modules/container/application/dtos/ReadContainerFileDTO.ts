export interface ReadContainerFileInputDTO {
    teamId: string;
    containerId: string;
    path: string;
};

export interface ReadContainerFileOutputDTO {
    content: string;
};
