import {
    GetTeamClusterByIdInputDTO,
    GetTeamClusterByIdOutputDTO
} from '@modules/team-cluster/application/dtos/GetTeamClusterByIdDTO';
import { toTeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import { requireOwnedTeamCluster } from '@modules/team-cluster/application/utilities/team-cluster-ownership';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetTeamClusterByIdUseCase implements IUseCase<GetTeamClusterByIdInputDTO, GetTeamClusterByIdOutputDTO, ApplicationError> {
    constructor(
        
        private readonly teamClusterRepository: TeamClusterRepository
    ){}

    async execute(input: GetTeamClusterByIdInputDTO): Promise<Result<GetTeamClusterByIdOutputDTO, ApplicationError>> {
        const teamCluster = await requireOwnedTeamCluster(this.teamClusterRepository, input);
        if (teamCluster instanceof ApplicationError) {
            return Result.fail(teamCluster);
        }

        return Result.ok({
            teamCluster: toTeamClusterDTO(teamCluster)
        });
    }
};
