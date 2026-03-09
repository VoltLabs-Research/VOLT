import {
    RecordTeamClusterHeartbeatInputDTO,
    RecordTeamClusterHeartbeatOutputDTO
} from '@modules/team-cluster/application/dtos/RecordTeamClusterHeartbeatDTO';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class RecordTeamClusterHeartbeatUseCase implements IUseCase<
    RecordTeamClusterHeartbeatInputDTO,
    RecordTeamClusterHeartbeatOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    async execute(input: RecordTeamClusterHeartbeatInputDTO): Promise<Result<RecordTeamClusterHeartbeatOutputDTO, ApplicationError>> {
        try {
            const teamCluster = await this.teamClusterLifecycleService.recordHeartbeat(
                input.teamClusterId,
                input.daemonPassword,
                input.installedVersion,
                input.metrics
            );

            return Result.ok({
                teamCluster
            });
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(ApplicationError.internalServerError('Failed to record team cluster heartbeat'));
        }
    }
};
