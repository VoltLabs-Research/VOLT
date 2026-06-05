import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import {
    GetClusterResourceLimitsInputDTO,
    GetClusterResourceLimitsOutputDTO
} from '@modules/cluster/application/dtos/GetClusterResourceLimitsDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

const MB_PER_GB = 1024;

@Singleton()
export default class GetClusterResourceLimitsUseCase
    implements IUseCase<GetClusterResourceLimitsInputDTO, GetClusterResourceLimitsOutputDTO, ApplicationError> {

    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(SYSTEM_TOKENS.SystemMetricsRepository) private readonly systemMetricsRepository: ISystemMetricsRepository
    ){}

    async execute(
        input: GetClusterResourceLimitsInputDTO
    ): Promise<Result<GetClusterResourceLimitsOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        const metrics = await this.systemMetricsRepository.getLatestByClusterId(input.teamClusterId);
        if (!metrics) {
            return Result.ok({
                resourceLimits: {
                    maxCpus: null,
                    maxMemoryMB: null,
                    status: null,
                    lastUpdatedAt: null
                }
            });
        }

        return Result.ok({
            resourceLimits: {
                maxCpus: metrics.cpu.cores,
                maxMemoryMB: Math.floor(metrics.memory.total * MB_PER_GB),
                status: metrics.status,
                lastUpdatedAt: metrics.timestamp.toISOString()
            }
        });
    }
};
