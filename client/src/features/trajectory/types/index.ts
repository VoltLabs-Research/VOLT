export interface GetTrajectoriesParams {
    page?: number;
    limit?: number;
    search?: string;
    populate?: string;
}

export interface FsListResponse {
    files: Array<{
        name: string;
        type: 'file' | 'directory';
        size?: number;
        path: string;
    }>;
    currentPath: string;
}

export interface TrajectoryInfo {
    name: string;
    path: string;
    id: string;
    totalFrames: number;
}
