import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import type DaemonAnalysisCompletionService from '@modules/team-cluster/infrastructure/services/DaemonAnalysisCompletionService';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

export interface ProcessDaemonJobCompletionInputDTO {
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    success: boolean;
    error?: string;
};

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

            await this.daemonAnalysisCompletionService.handleJobCompletion({
                jobId: input.jobId,
                analysisId: input.analysisId,
                teamId: input.teamId,
                success: input.success,
                error: input.error
            });

            return Result.ok({ acknowledged: true });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(
                ApplicationError.internalServerError('Failed to process daemon job completion')
            );
        }
    }
};
