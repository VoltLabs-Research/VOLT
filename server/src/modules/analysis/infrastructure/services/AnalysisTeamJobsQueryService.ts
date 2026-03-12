import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { inject, injectable } from 'tsyringe';
import type {
    AnalysisJobMetadata,
    AnalysisJobSummary,
    IAnalysisTeamJobsQueryService
} from '@modules/analysis/domain/port/IAnalysisTeamJobsQueryService';

interface TeamJobSummaryRecord {
    jobId: string;
    teamId: string;
    queueType: string;
    status: string;
    sessionId?: string;
    message?: string;
    metadata?: AnalysisJobMetadata;
    analysisId?: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
};

interface TeamJobsReader {
    getFlatTeamJobs(teamId: string): Promise<TeamJobSummaryRecord[]>;
};

@injectable()
export default class AnalysisTeamJobsQueryService implements IAnalysisTeamJobsQueryService {
    constructor(
        @inject(TEAM_TOKENS.TeamJobsService)
        private readonly teamJobsService: TeamJobsReader
    ) {}

    async getFlatTeamJobs(teamId: string): Promise<AnalysisJobSummary[]> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);

        return teamJobs.map((job) => ({
            jobId: job.jobId,
            teamId: job.teamId,
            queueType: job.queueType,
            status: job.status,
            sessionId: job.sessionId,
            message: job.message,
            metadata: job.metadata,
            analysisId: typeof job.analysisId === 'string' ? job.analysisId : undefined,
            trajectoryId: typeof job.trajectoryId === 'string' ? job.trajectoryId : undefined,
            trajectoryName: typeof job.trajectoryName === 'string' ? job.trajectoryName : undefined,
            timestep: typeof job.timestep === 'number' ? job.timestep : undefined
        }));
    }
};
