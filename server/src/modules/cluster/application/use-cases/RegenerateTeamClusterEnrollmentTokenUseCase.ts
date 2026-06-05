import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type { ITeamClusterRepository } from '@modules/cluster/domain/port/ITeamClusterRepository';
import {
    RegenerateTeamClusterEnrollmentTokenInputDTO,
    RegenerateTeamClusterEnrollmentTokenOutputDTO
} from '@modules/cluster/application/dtos/RegenerateTeamClusterEnrollmentTokenDTO';
import { requireOwnedTeamCluster } from '@modules/cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import { createEnrollmentToken, hashEnrollmentToken } from '@modules/cluster/utilities/enrollmentToken';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import logger from '@shared/infrastructure/logger';

const WAITING_STATUSES = new Set<TeamClusterStatus>([
    TeamClusterStatus.WaitingForConnection,
    TeamClusterStatus.HealthcheckReceived,
    TeamClusterStatus.PreparingEnvironment,
    TeamClusterStatus.Disconnected
]);

@Singleton()
export default class RegenerateTeamClusterEnrollmentTokenUseCase
    implements IUseCase<RegenerateTeamClusterEnrollmentTokenInputDTO, RegenerateTeamClusterEnrollmentTokenOutputDTO, ApplicationError> {

    constructor(
        @inject(CLUSTER_TOKENS.TeamClusterRepository) private readonly teamClusterRepository: ITeamClusterRepository
    ){}

    async execute(
        input: RegenerateTeamClusterEnrollmentTokenInputDTO
    ): Promise<Result<RegenerateTeamClusterEnrollmentTokenOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        if (!WAITING_STATUSES.has(teamCluster.props.status)) {
            return Result.fail(ApplicationError.conflict(
                'TeamCluster::InvalidStatusForTokenRegeneration',
                'Enrollment token can only be regenerated for clusters in a waiting or disconnected state'
            ));
        }

        const enrollmentToken = createEnrollmentToken();
        const enrollmentTokenHash = hashEnrollmentToken(enrollmentToken);

        await this.teamClusterRepository.updateById(input.teamClusterId, {
            enrollmentTokenHash
        });

        logger.info(`Team cluster enrollment token regenerated teamClusterId=${input.teamClusterId} teamId=${input.teamId} userId=${input.userId}`);

        return Result.ok({
            enrollmentToken
        });
    }
};
