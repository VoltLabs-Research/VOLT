export interface TrajectoryProcessingJobProps {
    jobId: string;
    trajectoryId: string;
    trajectoryName: string;
    timestep: number;
    teamId: string;
    name: string;
    message: string;
    sessionId?: string;
    file?: {
        frameInfo: any;
        frameFilePath: string;
    };
};