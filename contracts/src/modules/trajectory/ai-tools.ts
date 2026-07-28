import type { tags } from 'typia';

export interface ListTrajectoriesInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<20>;
    folderId?: string;
    search?: string;
}

export interface ListPublicTrajectoriesInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<20>;
    search?: string;
}

export interface ListSampleSimulationsInput{}

export interface GetTrajectoryInput{
    trajectoryId: string;
}

export interface GetTrajectoryTeamMetricsInput{}

export interface UpdateTrajectoryInput{
    trajectoryId: string;
    name: string;
    isPublic: boolean;
}

export interface CloneTrajectoryInput{
    sourceTrajectoryId: string;
    targetClusterId?: string;
}

export interface MoveTrajectoryInput{
    trajectoryId: string;
    folderId: string | null;
}

export interface DeleteTrajectoryInput{
    trajectoryId: string;
    reason?: string;
}

export interface DeleteTrajectoryFolderInput{
    folderId: string;
    reason?: string;
}
