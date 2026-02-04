export interface Team {
    _id: string;
    name: string;
    description?: string;
    owner: User | string;
    members: (User | string)[];
    trajectories: (Trajectory | string)[];
    createdAt: string;
    updatedAt: string;
}

export interface User {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    teams: (Team | string)[];
    role: 'user' | 'admin';
    avatar?: string;
    createdAt: string;
    updatedAt: string;
}

export interface BoxBounds {
    xlo: number;
    xhi: number;
    ylo: number;
    yhi: number;
    zlo: number;
    zhi: number;
}

export interface TimestepInfo {
    timestep: number;
    natoms: number;
    boxBounds: BoxBounds;
}

export interface TrajectoryProcessingProgress {
    stage: 'parsing' | 'processing' | 'uploading' | 'rasterizing' | 'completed' | 'failed';
    currentStep: number;
    totalSteps: number;
    percentage: number;
    message?: string;
}

export interface TrajectoryStats {
    totalFiles: number;
    totalSize: number;
    processedFrames?: number;
    uploadedFrames?: number;
}

export interface Trajectory {
    _id: string;
    name: string;
    team: Team | string;
    analysis: Analysis[];
    frames: TimestepInfo[];
    stats: TrajectoryStats;
    preview?: any;
    isPublic?: boolean;
    status?: 'waiting_for_proccess' | 'queued' | 'processing' | 'rendering' | 'completed' | 'failed';
    processingProgress?: TrajectoryProcessingProgress;
    createdAt: string;
    updatedAt: string;
    users: (User | string)[];
    createdBy?: User | string;
    availableModels?: {
        atomicStructure: boolean;
        dislocations: boolean;
        bonds: boolean;
        simulationCell: boolean;
        structureIdentification: boolean;
    };
}

export interface Notification {
    _id: string;
    recipient: User | string;
    title: string;
    content: string;
    read: boolean;
    link?: string;
    createdAt: string;
    updatedAt: string;
}

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Analysis {
    _id: string;
    plugin: string;
    modifier: string;
    config: Record<string, any>;
    trajectory: Trajectory | string;
    status?: AnalysisStatus;
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: string;
    finishedAt?: string;
    lastFrameProcessed?: number;
    createdAt: string;
    updatedAt: string;
}

export interface TeamInvitation {
    _id: string;
    team: {
        _id: string;
        name: string;
        description?: string;
        memberCount?: number;
    };
    invitedBy: {
        email: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
    };
    email: string;
    token: string;
    role: 'Can view' | 'Can edit' | 'Full access';
    expiresAt: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
    updatedAt: string;
}

export interface TeamRole {
    _id: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    team: string;
    createdAt: string;
    updatedAt: string;
}

export interface TeamRolePayload {
    name: string;
    permissions: string[];
}

export interface TeamMemberWithRole {
    _id: string;
    user: {
        _id: string;
        email: string;
        firstName: string;
        lastName: string;
        avatar?: string;
    } | string;
    role?: TeamRole;
    joinedAt: string;
}

