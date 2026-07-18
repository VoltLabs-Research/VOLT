import {
    UpdateTeamClusterLifecycleInputDTO,
    UpdateTeamClusterLifecycleOutputDTO
} from '@modules/cluster/application/dtos/UpdateTeamClusterLifecycleDTO';
import { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import type { ITeamClusterLifecycleService } from '@modules/cluster/domain/port/ITeamClusterLifecycleService';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class UpdateTeamClusterLifecycleUseCase implements IUseCase<UpdateTeamClusterLifecycleInputDTO, UpdateTeamClusterLifecycleOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService
    ){}

    async execute(input: UpdateTeamClusterLifecycleInputDTO): Promise<UpdateTeamClusterLifecycleOutputDTO> {
        if (input.status === TeamClusterStatus.Connected) {
            throw ApplicationError.badRequest(
                'TeamCluster::SocketLifecycleOnly',
                'Connected status is managed by daemon socket registration'
            );
        }

        if (input.status === TeamClusterStatus.WaitingForConnection) {
            throw ApplicationError.badRequest(
                'TeamCluster::LifecycleStatusInvalid',
                'Waiting-for-connection is managed by the control plane'
            );
        }

        try {
            const teamCluster = await this.teamClusterLifecycleService.updateLifecycleStatus(
                input.teamClusterId,
                input.daemonPassword,
                input.status,
                input.installedVersion
            );

            return {
                teamCluster
            };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to update team cluster lifecycle');
        }
    }
};
