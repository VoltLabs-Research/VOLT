import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { inject, injectable } from 'tsyringe';
import type {
    AnalysisJobMetadata,
    AnalysisJobSummary,
    IAnalysisTeamJobsQueryService
} from '@modules/analysis/domain/port/IAnalysisTeamJobsQueryService';
import type { TeamJobSummary } from '@modules/team/socket/team/TeamJobsService';

interface TeamVisibleHistoryReader {
    getFlatTeamJobs(teamId: string): Promise<TeamJobSummary[]>;
};

@injectable()
export default class AnalysisTeamJobsQueryService implements IAnalysisTeamJobsQueryService {
    constructor(
        @inject(TEAM_TOKENS.TeamJobsService)
        private readonly teamJobsService: TeamVisibleHistoryReader
    ) {}

    async getFlatTeamJobs(teamId: string): Promise<AnalysisJobSummary[]> {
        const teamJobs = await this.teamJobsService.getFlatTeamJobs(teamId);

        return teamJobs.map((job) => this.mapJobSummary(job));
    }

    private mapJobSummary(job: TeamJobSummary): AnalysisJobSummary {
        const analysisId = this.resolveString(job.analysisId, job.metadata?.analysisId);
        const trajectoryId = this.resolveString(job.trajectoryId, job.metadata?.trajectoryId);
        const trajectoryName = this.resolveString(job.trajectoryName, job.metadata?.trajectoryName);
        const timestep = this.resolveTimestep(job);

        return {
            jobId: job.jobId,
            name: typeof job.name === 'string' ? job.name : undefined,
            teamId: job.teamId,
            queueType: job.queueType,
            status: job.status,
            sessionId: job.sessionId,
            message: job.message,
            metadata: this.mapMetadata(job, analysisId, trajectoryId, trajectoryName, timestep),
            analysisId,
            trajectoryId,
            trajectoryName,
            timestep
        };
    }

    private mapMetadata(
        job: TeamJobSummary,
        analysisId?: string,
        trajectoryId?: string,
        trajectoryName?: string,
        timestep?: number
    ): AnalysisJobMetadata | undefined {
        if (!job.metadata) {
            return undefined;
        }

        const {
            analysisId: _metadataAnalysisId,
            trajectoryId: _metadataTrajectoryId,
            trajectoryName: _metadataTrajectoryName,
            timestep: _metadataTimestep,
            ...restMetadata
        } = job.metadata;

        return {
            ...restMetadata,
            ...(typeof analysisId === 'string' ? { analysisId } : {}),
            ...(typeof trajectoryId === 'string' ? { trajectoryId } : {}),
            ...(typeof trajectoryName === 'string' ? { trajectoryName } : {}),
            ...(typeof timestep === 'number' ? { timestep } : {})
        };
    }

    private resolveString(primary?: string, fallback?: unknown): string | undefined {
        if (typeof primary === 'string') {
            return primary;
        }

        return typeof fallback === 'string' ? fallback : undefined;
    }

    private resolveTimestep(job: TeamJobSummary): number | undefined {
        if (typeof job.timestep === 'number' && Number.isFinite(job.timestep)) {
            return job.timestep;
        }

        if (typeof job.metadata?.timestep === 'number' && Number.isFinite(job.metadata.timestep)) {
            return job.metadata.timestep;
        }

        if (typeof job.metadata?.timestep === 'string' && job.metadata.timestep.trim().length > 0) {
            const parsedTimestep = Number(job.metadata.timestep);
            if (Number.isFinite(parsedTimestep)) {
                return parsedTimestep;
            }
        }

        return undefined;
    }
};
