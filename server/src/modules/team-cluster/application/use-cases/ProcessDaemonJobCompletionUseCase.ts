import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import { JobStatus } from '@modules/jobs/domain/entities/Job';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

type RasterJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type GlbJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type SshImportJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;

interface DaemonAnalysisJobCompletionPayload {
    teamClusterId: string;
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
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: RasterJobStatus;
    error?: string;
};

interface DaemonGlbJobStatusPayload {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: GlbJobStatus;
    error?: string;
};

interface DaemonAnalysisJobStatusPayload {
    teamClusterId: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface DaemonSshImportJobStatusPayload {
    teamClusterId: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    status: SshImportJobStatus;
    error?: string;
};

interface DaemonJobCompletionService {
    handleJobCompletion(input: DaemonAnalysisJobCompletionPayload): Promise<void>;
    handleRasterJobStatus(input: DaemonRasterJobStatusPayload): Promise<void>;
    handleGlbJobStatus(input: DaemonGlbJobStatusPayload): Promise<void>;
    handleAnalysisJobStatus(input: DaemonAnalysisJobStatusPayload): Promise<void>;
    handleSshImportJobStatus(input: DaemonSshImportJobStatusPayload): Promise<void>;
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

interface ProcessDaemonAnalysisJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface ProcessDaemonRasterJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface ValidProcessDaemonRasterJobStatusInputDTO extends ProcessDaemonRasterJobStatusInputDTO {
    status: RasterJobStatus;
};

interface ProcessDaemonGlbJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface ValidProcessDaemonGlbJobStatusInputDTO extends ProcessDaemonGlbJobStatusInputDTO {
    status: GlbJobStatus;
};

interface ProcessDaemonSshImportJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    status: JobStatus;
    error?: string;
};

interface ValidProcessDaemonSshImportJobStatusInputDTO extends ProcessDaemonSshImportJobStatusInputDTO {
    status: SshImportJobStatus;
};

export type ProcessDaemonJobCompletionInputDTO =
    | ProcessDaemonAnalysisJobCompletionInputDTO
    | ProcessDaemonAnalysisJobStatusInputDTO
    | ProcessDaemonRasterJobStatusInputDTO
    | ProcessDaemonGlbJobStatusInputDTO
    | ProcessDaemonSshImportJobStatusInputDTO;

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

            if (this.isAnalysisJobStatusInput(input)) {
                await this.daemonAnalysisCompletionService.handleAnalysisJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    name: input.name,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    trajectoryName: input.trajectoryName,
                    timestep: input.timestep,
                    status: input.status,
                    error: input.error
                });

                return Result.ok({ acknowledged: true });
            }

            if (this.isAnalysisJobCompletionInput(input)) {
                await this.daemonAnalysisCompletionService.handleJobCompletion({
                    teamClusterId: input.teamClusterId,
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

            if (this.isGlbJobStatusInput(input)) {
                await this.daemonAnalysisCompletionService.handleGlbJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    trajectoryName: input.trajectoryName,
                    timestep: input.timestep,
                    status: input.status,
                    error: input.error
                });

                return Result.ok({ acknowledged: true });
            }

            if (this.isSshImportJobStatusInput(input)) {
                await this.daemonAnalysisCompletionService.handleSshImportJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    trajectoryName: input.trajectoryName,
                    status: input.status,
                    error: input.error
                });

                return Result.ok({ acknowledged: true });
            }

            if (this.isRasterJobStatusInput(input)) {
                await this.daemonAnalysisCompletionService.handleRasterJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    trajectoryName: input.trajectoryName,
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

    private isAnalysisJobStatusInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ProcessDaemonAnalysisJobStatusInputDTO {
        return 'analysisId' in input && 'status' in input && !('success' in input);
    }

    private isAnalysisJobCompletionInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ProcessDaemonAnalysisJobCompletionInputDTO {
        return 'analysisId' in input && !this.hasJobStatusFields(input);
    }

    private isGlbJobStatusInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ValidProcessDaemonGlbJobStatusInputDTO {
        return this.hasJobStatusFields(input)
            && !this.hasAnalysisJobCompletionFields(input)
            && this.isGlbJobId(input.jobId)
            && this.isValidJobStatus(input.status);
    }

    private isSshImportJobStatusInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ValidProcessDaemonSshImportJobStatusInputDTO {
        return this.hasJobStatusFields(input)
            && !this.hasAnalysisJobCompletionFields(input)
            && this.isSshImportJobId(input.jobId)
            && this.isValidJobStatus(input.status);
    }

    private isRasterJobStatusInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ValidProcessDaemonRasterJobStatusInputDTO {
        return this.hasJobStatusFields(input)
            && !this.hasAnalysisJobCompletionFields(input)
            && !this.isGlbJobId(input.jobId)
            && !this.isSshImportJobId(input.jobId)
            && this.isValidJobStatus(input.status);
    }

    private hasAnalysisJobCompletionFields(input: ProcessDaemonJobCompletionInputDTO): boolean {
        return 'analysisId' in input || 'name' in input || 'success' in input;
    }

    private hasJobStatusFields(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ProcessDaemonRasterJobStatusInputDTO {
        return 'jobId' in input && 'trajectoryId' in input && 'status' in input;
    }

    private isGlbJobId(jobId: string): boolean {
        return jobId.startsWith('trajectory-glb:');
    }

    private isSshImportJobId(jobId: string): boolean {
        return jobId.startsWith('ssh-import:');
    }

    private isValidJobStatus(status: JobStatus): status is RasterJobStatus {
        return status === JobStatus.Running
            || status === JobStatus.Completed
            || status === JobStatus.Failed;
    }
};
