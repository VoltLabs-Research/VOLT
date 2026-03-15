import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

type RasterJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;

interface DaemonAnalysisJobCompletionPayload {
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    success: boolean;
    error?: string;
};

interface DaemonRasterJobStatusPayload {
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: RasterJobStatus;
    error?: string;
};

interface DaemonJobCompletionService {
    handleJobCompletion(input: DaemonAnalysisJobCompletionPayload): Promise<void>;
    handleRasterJobStatus(input: DaemonRasterJobStatusPayload): Promise<void>;
};

interface ProcessDaemonAnalysisJobCompletionInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    success: boolean;
    error?: string;
};

interface ProcessDaemonRasterJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface ValidProcessDaemonRasterJobStatusInputDTO extends ProcessDaemonRasterJobStatusInputDTO {
    status: RasterJobStatus;
};

export type ProcessDaemonJobCompletionInputDTO =
    | ProcessDaemonAnalysisJobCompletionInputDTO
    | ProcessDaemonRasterJobStatusInputDTO;

interface ProcessDaemonJobCompletionOutputDTO {
    acknowledged: boolean;
};

@injectable()
export default class ProcessDaemonJobCompletionUseCase implements IUseCase<
    ProcessDaemonJobCompletionInputDTO,
    ProcessDaemonJobCompletionOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(TEAM_CLUSTER_TOKENS.DaemonAnalysisCompletionService)
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService & DaemonJobCompletionService
    ) {}

    async execute(
        input: ProcessDaemonJobCompletionInputDTO
    ): Promise<Result<ProcessDaemonJobCompletionOutputDTO, ApplicationError>> {
        try {
            await this.teamClusterLifecycleService.authenticateDaemonConnection(
                input.teamClusterId,
                input.daemonPassword
            );

            if (this.isAnalysisJobCompletionInput(input)) {
                await this.daemonAnalysisCompletionService.handleJobCompletion({
                    jobId: input.jobId,
                    name: input.name,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    trajectoryName: input.trajectoryName,
                    timestep: input.timestep,
                    success: input.success,
                    error: input.error
                });

                return Result.ok({ acknowledged: true });
            }

            if (this.isRasterJobStatusInput(input)) {
                await this.daemonAnalysisCompletionService.handleRasterJobStatus({
                    jobId: input.jobId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
                    status: input.status,
                    error: input.error
                });

                return Result.ok({ acknowledged: true });
            }

            return Result.fail(
                ApplicationError.badRequest(
                    'TEAM_CLUSTER_DAEMON_INVALID_JOB_COMPLETION_PAYLOAD',
                    'Invalid daemon job completion payload'
                )
            );
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(
                ApplicationError.internalServerError('Failed to process daemon job completion')
            );
        }
    }

    private isAnalysisJobCompletionInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ProcessDaemonAnalysisJobCompletionInputDTO {
        return 'analysisId' in input && !this.hasRasterJobStatusFields(input);
    }

    private isRasterJobStatusInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ValidProcessDaemonRasterJobStatusInputDTO {
        return this.hasRasterJobStatusFields(input)
            && !this.hasAnalysisJobCompletionFields(input)
            && this.isRasterJobStatus(input.status);
    }

    private hasAnalysisJobCompletionFields(input: ProcessDaemonJobCompletionInputDTO): boolean {
        return 'analysisId' in input || 'name' in input || 'success' in input;
    }

    private hasRasterJobStatusFields(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ProcessDaemonRasterJobStatusInputDTO {
        return 'jobId' in input && 'trajectoryId' in input && 'status' in input;
    }

    private isRasterJobStatus(status: JobStatus): status is RasterJobStatus {
        return status === JobStatus.Running
            || status === JobStatus.Completed
            || status === JobStatus.Failed;
    }
};
