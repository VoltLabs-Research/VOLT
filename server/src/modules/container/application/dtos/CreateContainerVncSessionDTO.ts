export interface CreateContainerVncSessionInputDTO {
    teamId: string;
    containerId: string;
    userId: string;
    password: string;
    parentOrigin: string;
    width?: number;
    height?: number;
    dpi?: number;
};

export interface ContainerVncSessionDTO {
    noVncUrl: string;
    expiresAt: string;
};

export interface CreateContainerVncSessionOutputDTO {
    session: ContainerVncSessionDTO;
};
