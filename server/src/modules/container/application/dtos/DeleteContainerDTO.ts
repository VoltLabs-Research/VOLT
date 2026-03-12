export interface DeleteContainerInputDTO {
    teamId: string;
    containerId: string;
    userId?: string;
};

export interface DeleteContainerOutputDTO {
    message: string;
};
