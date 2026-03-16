export interface GetPublicCanvasBootstrapInputDTO {
    trajectoryId: string;
    userId?: string;
};

export interface PublicCanvasFrameDTO {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

export interface PublicCanvasBootstrapTrajectoryDTO {
    _id: string;
    name: string;
    status: string;
    isPublic: boolean;
    teamId: string;
    analysisIds: string[];
    frames: PublicCanvasFrameDTO[];
};

export interface PublicCanvasAccessDTO {
    mode: PublicCanvasAccessMode;
    isGuest: boolean;
    isPublic: boolean;
    hasTeamMembership: boolean;
};

export interface GetPublicCanvasBootstrapOutputDTO {
    access: PublicCanvasAccessDTO;
    trajectory: PublicCanvasBootstrapTrajectoryDTO;
};

export enum PublicCanvasAccessMode {
    ReadOnly = 'read-only'
};
