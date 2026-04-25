import { JobStatus } from '@modules/jobs/domain/entities/Job';
import DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

type RasterJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type GlbJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type SshImportJobStatus = JobStatus.Running | JobStatus.Completed | JobStatus.Failed;
type ArtifactUploadJobStatus = JobStatus.Queued | JobStatus.Running | JobStatus.Completed | JobStatus.Failed;

interface ProcessDaemonAnalysisJobCompletionInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    name: string;
    analysisId: string;
    teamId: string;
    trajectoryId?: string;
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
    status: JobStatus;
    error?: string;
};

interface ValidProcessDaemonSshImportJobStatusInputDTO extends ProcessDaemonSshImportJobStatusInputDTO {
    status: SshImportJobStatus;
};

interface ProcessDaemonArtifactUploadJobStatusInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep?: number;
    status: JobStatus;
    error?: string;
};

interface ValidProcessDaemonArtifactUploadJobStatusInputDTO extends ProcessDaemonArtifactUploadJobStatusInputDTO {
    status: ArtifactUploadJobStatus;
};

export type ProcessDaemonJobCompletionInputDTO =
    | ProcessDaemonAnalysisJobCompletionInputDTO
    | ProcessDaemonAnalysisJobStatusInputDTO
    | ProcessDaemonRasterJobStatusInputDTO
    | ProcessDaemonGlbJobStatusInputDTO
    | ProcessDaemonSshImportJobStatusInputDTO
    | ProcessDaemonArtifactUploadJobStatusInputDTO;

interface ProcessDaemonJobCompletionOutputDTO {
    acknowledged: boolean;
};

@Singleton()
export default class ProcessDaemonJobCompletionUseCase implements IUseCase<
    ProcessDaemonJobCompletionInputDTO,
    ProcessDaemonJobCompletionOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        
        private readonly daemonAnalysisCompletionService: DaemonAnalysisCompletionService
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
                    status: input.status,
                    error: input.error
                });

                return Result.ok({ acknowledged: true });
            }

            if (this.isArtifactUploadJobStatusInput(input)) {
                await this.daemonAnalysisCompletionService.handleArtifactUploadJobStatus({
                    teamClusterId: input.teamClusterId,
                    jobId: input.jobId,
                    analysisId: input.analysisId,
                    teamId: input.teamId,
                    trajectoryId: input.trajectoryId,
                    timestep: input.timestep,
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
        return 'analysisId' in input && 'name' in input && 'status' in input && !('success' in input);
    }

    private isAnalysisJobCompletionInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ProcessDaemonAnalysisJobCompletionInputDTO {
        return 'analysisId' in input && 'name' in input && 'success' in input && !this.hasJobStatusFields(input);
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

    private isArtifactUploadJobStatusInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ValidProcessDaemonArtifactUploadJobStatusInputDTO {
        return this.hasJobStatusFields(input)
            && !this.hasAnalysisJobCompletionFields(input)
            && this.isArtifactUploadJobId(input.jobId)
            && this.isValidArtifactUploadJobStatus(input.status);
    }

    private isRasterJobStatusInput(
        input: ProcessDaemonJobCompletionInputDTO
    ): input is ValidProcessDaemonRasterJobStatusInputDTO {
        return this.hasJobStatusFields(input)
            && !this.hasAnalysisJobCompletionFields(input)
            && !this.isGlbJobId(input.jobId)
            && !this.isSshImportJobId(input.jobId)
            && !this.isArtifactUploadJobId(input.jobId)
            && this.isValidJobStatus(input.status);
    }

    private hasAnalysisJobCompletionFields(input: ProcessDaemonJobCompletionInputDTO): boolean {
        return 'name' in input || 'success' in input;
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

    private isArtifactUploadJobId(jobId: string): boolean {
        return jobId.startsWith('artifact-upload-');
    }

    private isValidJobStatus(status: JobStatus): status is RasterJobStatus {
        return status === JobStatus.Running
            || status === JobStatus.Completed
            || status === JobStatus.Failed;
    }

    private isValidArtifactUploadJobStatus(status: JobStatus): status is ArtifactUploadJobStatus {
        return status === JobStatus.Queued
            || status === JobStatus.Running
            || status === JobStatus.Completed
            || status === JobStatus.Failed;
    }
};
