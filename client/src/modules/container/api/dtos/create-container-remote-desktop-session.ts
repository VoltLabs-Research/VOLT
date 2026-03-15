export interface CreateContainerRemoteDesktopSessionParams {
    teamId: string;
    containerId: string;
    password: string;
    parentOrigin: string;
    width?: number;
    height?: number;
    dpi?: number;
};
