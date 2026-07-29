export type { TeamClusterFailureDetail, RemoveTeamJobsResult, RetryTeamJobsResult } from '@volt/contracts/modules/jobs/domain';
import type { RemoveTeamJobsResult, RetryTeamJobsResult } from '@volt/contracts/modules/jobs/domain';

export interface TrajectoryDeletedCleanupInput {
    teamId: string;
    trajectoryId: string;
    storageClusterId?: string;
    analysisIds?: string[];
    analysisComputeClusterIds?: string[];
}

export interface AnalysisDeletedCleanupInput {
    analysisId: string;
    teamId: string;
    computeClusterId?: string;
}

export interface ITeamJobMaintenanceService {
    retryJobs(teamId: string, jobIds: string[]): Promise<RetryTeamJobsResult>;
    removeJobsForAnalysis(teamId: string, analysisId: string): Promise<RemoveTeamJobsResult>;
    removeJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RemoveTeamJobsResult>;
    retryFailedJobsForTrajectory(teamId: string, trajectoryId: string): Promise<RetryTeamJobsResult>;
    cleanupDeletedTrajectory(input: TrajectoryDeletedCleanupInput): Promise<void>;
    cleanupDeletedAnalysis(input: AnalysisDeletedCleanupInput): Promise<void>;
}
