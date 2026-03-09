import {
    CompleteTeamClusterDeletionInputDTO,
    CompleteTeamClusterDeletionOutputDTO
} from '@modules/team-cluster/application/dtos/CompleteTeamClusterDeletionDTO';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class CompleteTeamClusterDeletionUseCase implements IUseCase<
    CompleteTeamClusterDeletionInputDTO,
    CompleteTeamClusterDeletionOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    async execute(input: CompleteTeamClusterDeletionInputDTO): Promise<Result<CompleteTeamClusterDeletionOutputDTO, ApplicationError>> {
        try {
            await this.teamClusterLifecycleService.completeDeletion(input.teamClusterId, input.daemonPassword);

            return Result.ok({
                success: true
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                if (error.statusCode === 404) {
                    return Result.ok({
                        success: true
                    });
                }

                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to complete team cluster deletion'));
        }
    }
};
