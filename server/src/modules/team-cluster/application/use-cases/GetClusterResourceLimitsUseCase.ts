import {
    GetClusterResourceLimitsInputDTO,
    GetClusterResourceLimitsOutputDTO
} from '@modules/team-cluster/application/dtos/GetClusterResourceLimitsDTO';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

const MB_PER_GB = 1024;

@injectable()
export default class GetClusterResourceLimitsUseCase
    implements IUseCase<GetClusterResourceLimitsInputDTO, GetClusterResourceLimitsOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly systemMetricsRepository: ISystemMetricsRepository
    ){}

    async execute(
        input: GetClusterResourceLimitsInputDTO
    ): Promise<Result<GetClusterResourceLimitsOutputDTO, ApplicationError>> {
        const teamCluster = await this.teamClusterRepository.findById(input.teamClusterId);
        if (!teamCluster || teamCluster.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                'TeamCluster::NotFound',
                'Team cluster not found'
            ));
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
