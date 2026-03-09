import {
    UpdateTeamClusterLifecycleInputDTO,
    UpdateTeamClusterLifecycleOutputDTO
} from '@modules/team-cluster/application/dtos/UpdateTeamClusterLifecycleDTO';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class UpdateTeamClusterLifecycleUseCase implements IUseCase<
    UpdateTeamClusterLifecycleInputDTO,
    UpdateTeamClusterLifecycleOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    async execute(input: UpdateTeamClusterLifecycleInputDTO): Promise<Result<UpdateTeamClusterLifecycleOutputDTO, ApplicationError>> {
        if (input.status === TeamClusterStatus.Connected) {
            return Result.fail(ApplicationError.badRequest(
                'TeamCluster::HeartbeatRequired',
                'Connected status must be reported through the heartbeat endpoint'
            ));
        }

        if (input.status === TeamClusterStatus.WaitingForConnection) {
            return Result.fail(ApplicationError.badRequest(
                'TeamCluster::LifecycleStatusInvalid',
                'Waiting-for-connection is managed by the control plane'
            ));
        }

        try {
            const teamCluster = await this.teamClusterLifecycleService.updateLifecycleStatus(
                input.teamClusterId,
                input.daemonPassword,
                input.status,
                input.installedVersion
            );

            return Result.ok({
                teamCluster
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to update team cluster lifecycle'));
        }
    }
};
