export interface CreateContainerXrdpSessionInputDTO {
    teamId: string;
    containerId: string;
    userId: string;
    username: string;
    password: string;
    width?: number;
    height?: number;
    dpi?: number;
};

export interface ContainerXrdpSessionDTO {
    token: string;
    websocketPath: string;
    expiresAt: string;
};

export interface CreateContainerXrdpSessionOutputDTO {
    session: ContainerXrdpSessionDTO;
};
