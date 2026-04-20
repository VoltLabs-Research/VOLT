import {
    RegenerateTeamClusterEnrollmentTokenInputDTO,
    RegenerateTeamClusterEnrollmentTokenOutputDTO
} from '@modules/team-cluster/application/dtos/RegenerateTeamClusterEnrollmentTokenDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import { TeamClusterStatus } from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import { createEnrollmentToken, hashEnrollmentToken } from '@modules/team-cluster/utilities/enrollmentToken';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

const WAITING_STATUSES = new Set<TeamClusterStatus>([
    TeamClusterStatus.WaitingForConnection,
    TeamClusterStatus.HealthcheckReceived,
    TeamClusterStatus.PreparingEnvironment,
    TeamClusterStatus.Disconnected
]);

@injectable()
export default class RegenerateTeamClusterEnrollmentTokenUseCase
    implements IUseCase<RegenerateTeamClusterEnrollmentTokenInputDTO, RegenerateTeamClusterEnrollmentTokenOutputDTO, ApplicationError> {

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
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
