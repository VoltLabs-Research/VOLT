import {
    RecordTeamClusterHeartbeatInputDTO,
    RecordTeamClusterHeartbeatOutputDTO
} from '@modules/cluster/dtos/RecordTeamClusterHeartbeatDTO';
import type { ITeamClusterLifecycleService } from '@modules/cluster/ports/ITeamClusterLifecycleService';
import { CLUSTER_TOKENS } from '@modules/cluster/di/ClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export default class RecordTeamClusterHeartbeatUseCase implements IUseCase<RecordTeamClusterHeartbeatInputDTO, RecordTeamClusterHeartbeatOutputDTO> {
    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterLifecycleService) private readonly teamClusterLifecycleService: ITeamClusterLifecycleService
    ){}

    async execute(input: RecordTeamClusterHeartbeatInputDTO): Promise<RecordTeamClusterHeartbeatOutputDTO> {
        try {
            const teamCluster = await this.teamClusterLifecycleService.recordHeartbeat(
                input.teamClusterId,
                input.daemonPassword,
                input.installedVersion,
                input.runtime,
                input.metrics
            );

            return {
                teamCluster
            };
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw ApplicationError.internalServerError('Failed to record team cluster heartbeat');
        }
    }
};
