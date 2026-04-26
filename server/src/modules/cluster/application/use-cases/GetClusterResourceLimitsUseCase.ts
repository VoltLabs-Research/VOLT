import SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import {
    GetClusterResourceLimitsInputDTO,
    GetClusterResourceLimitsOutputDTO
} from '@modules/cluster/application/dtos/GetClusterResourceLimitsDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

const MB_PER_GB = 1024;

@Singleton()
export default class GetClusterResourceLimitsUseCase
    implements IUseCase<GetClusterResourceLimitsInputDTO, GetClusterResourceLimitsOutputDTO, ApplicationError> {

    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository,
        
        private readonly systemMetricsRepository: SystemMetricsRedisRepository
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
