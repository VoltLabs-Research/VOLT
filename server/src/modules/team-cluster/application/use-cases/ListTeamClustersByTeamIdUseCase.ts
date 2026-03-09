import {
    ListTeamClustersInputDTO,
    ListTeamClustersOutputDTO
} from '@modules/team-cluster/application/dtos/ListTeamClustersDTO';
import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class ListTeamClustersByTeamIdUseCase implements IUseCase<ListTeamClustersInputDTO, ListTeamClustersOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ){}

    async execute(input: ListTeamClustersInputDTO): Promise<Result<ListTeamClustersOutputDTO, ApplicationError>> {
        const result = await this.teamClusterRepository.findAll({
            filter: {
                team: input.teamId
            },
            page: input.page,
            limit: input.limit,
            sort: {
                createdAt: -1
            }
        });

        return Result.ok({
            ...result,
            data: result.data.map(toTeamClusterDTO)
        });
    }
};
