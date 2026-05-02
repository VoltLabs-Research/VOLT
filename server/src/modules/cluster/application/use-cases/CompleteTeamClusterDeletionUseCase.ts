import { CompleteTeamClusterDeletionInputDTO } from '@modules/cluster/application/dtos/CompleteTeamClusterDeletionDTO';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import type { OperationSuccessDTO } from '@modules/team/application/dtos/common';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class CompleteTeamClusterDeletionUseCase implements IUseCase<
    CompleteTeamClusterDeletionInputDTO,
    OperationSuccessDTO,
    ApplicationError
> {
    constructor(
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    async execute(input: CompleteTeamClusterDeletionInputDTO): Promise<Result<OperationSuccessDTO, ApplicationError>> {
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
