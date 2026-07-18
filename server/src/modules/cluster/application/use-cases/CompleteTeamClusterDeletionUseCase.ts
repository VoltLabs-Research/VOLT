import { CompleteTeamClusterDeletionInputDTO } from '@modules/cluster/application/dtos/CompleteTeamClusterDeletionDTO';
import type { ITeamClusterLifecycleService } from '@modules/cluster/domain/port/ITeamClusterLifecycleService';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { OperationSuccessDTO } from '@modules/team/application/dtos/common';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class CompleteTeamClusterDeletionUseCase implements IUseCase<CompleteTeamClusterDeletionInputDTO, OperationSuccessDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService
    ){}

    async execute(input: CompleteTeamClusterDeletionInputDTO): Promise<OperationSuccessDTO> {
        try {
            await this.teamClusterLifecycleService.completeDeletion(input.teamClusterId, input.daemonPassword);

            return {
                success: true
            };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                if (error.statusCode === 404) {
                    return {
                        success: true
                    };
                }

                throw error;
            }

            throw ApplicationError.internalServerError('Failed to complete team cluster deletion');
        }
    }
};
