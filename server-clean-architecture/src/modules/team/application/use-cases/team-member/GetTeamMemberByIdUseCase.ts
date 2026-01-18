import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetTeamMemberByIdInputDTO, GetTeamMemberByIdOutputDTO } from '@modules/team/application/dtos/team-member/GetTeamMemberByIdDTO';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';

@injectable()
export default class GetTeamMemberByIdUseCase implements IUseCase<GetTeamMemberByIdInputDTO, GetTeamMemberByIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository
    ){}

    async execute(input: GetTeamMemberByIdInputDTO): Promise<Result<GetTeamMemberByIdOutputDTO, ApplicationError>>{
        const { teamMemberId } = input;
        const teamMember = await this.teamMemberRepository.findById(teamMemberId);
        if(!teamMember){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        return Result.ok(teamMember.props);
    }
};