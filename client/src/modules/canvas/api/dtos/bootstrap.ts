export enum PublicCanvasAccessMode {
    ReadOnly = 'read-only'
};

export interface PublicCanvasFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

export interface PublicCanvasTrajectory {
    _id: string;
    name: string;
    status: string;
    isPublic: boolean;
    teamId: string;
    analysisIds: string[];
    frames: PublicCanvasFrame[];
};

export interface PublicCanvasAccess {
    mode: PublicCanvasAccessMode;
    isGuest: boolean;
    isPublic: boolean;
    hasTeamMembership: boolean;
};

export interface GetPublicCanvasBootstrapInput {
    trajectoryId: string;
};

export interface GetPublicCanvasBootstrapOutput {
    access: PublicCanvasAccess;
    trajectory: PublicCanvasTrajectory;
};
