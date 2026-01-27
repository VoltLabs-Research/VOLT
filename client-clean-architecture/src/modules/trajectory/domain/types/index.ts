export interface GetTrajectoriesParams {
    page?: number;
    limit?: number;
    search?: string;
}


export interface TrajectoryInfo {
    name: string;
    path: string;
    id: string;
    totalFrames: number;
}
