import {
    RecordTeamClusterHeartbeatInputDTO,
    RecordTeamClusterHeartbeatOutputDTO
} from '@modules/team-cluster/application/dtos/RecordTeamClusterHeartbeatDTO';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class RecordTeamClusterHeartbeatUseCase implements IUseCase<
    RecordTeamClusterHeartbeatInputDTO,
    RecordTeamClusterHeartbeatOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService
    ){}

    async execute(input: RecordTeamClusterHeartbeatInputDTO): Promise<Result<RecordTeamClusterHeartbeatOutputDTO, ApplicationError>> {
        try {
            const teamCluster = await this.teamClusterLifecycleService.recordHeartbeat(
                input.teamClusterId,
                input.daemonPassword,
                input.installedVersion,
                input.runtime,
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
