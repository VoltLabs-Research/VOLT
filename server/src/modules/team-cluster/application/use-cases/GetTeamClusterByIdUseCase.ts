import {
    GetTeamClusterByIdInputDTO,
    GetTeamClusterByIdOutputDTO
} from '@modules/team-cluster/application/dtos/GetTeamClusterByIdDTO';
import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetTeamClusterByIdUseCase implements IUseCase<GetTeamClusterByIdInputDTO, GetTeamClusterByIdOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ){}

    async execute(input: GetTeamClusterByIdInputDTO): Promise<Result<GetTeamClusterByIdOutputDTO, ApplicationError>> {
        const teamCluster = await this.teamClusterRepository.findById(input.teamClusterId);
        if (!teamCluster || teamCluster.props.team !== input.teamId) {
            return Result.fail(ApplicationError.notFound(
                'TeamCluster::NotFound',
                'Team cluster not found'
            ));
        }

        return Result.ok({
            teamCluster: toTeamClusterDTO(teamCluster)
        });
    }
};
