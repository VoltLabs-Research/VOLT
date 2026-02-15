export interface AnalysisTrajectory {
    _id: string;
    name: string;
};

export interface Analysis {
    _id: string;
    plugin: string;
    pluginDisplayName?: string;
    config: Record<string, unknown>;
    trajectory: AnalysisTrajectory;
    totalFrames: number;
    completedFrames: number;
    startedAt?: Date;
    finishedAt?: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
};
