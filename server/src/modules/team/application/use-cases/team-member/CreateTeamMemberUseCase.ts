import { Result } from '@shared/domain/ports/Result';
import { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { CreateTeamMemberInputDTO, CreateTeamMemberOutputDTO } from '@modules/team/application/dtos/team-member/CreateTeamMemberDTO';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { ITeamRoleRepository } from '@modules/team/domain/ports/ITeamRoleRepository';
import { ITeamMemberRepository } from '@modules/team/domain/ports/ITeamMemberRepository';

@injectable()
export default class CreateTeamMemberUseCase implements IUseCase<CreateTeamMemberInputDTO, CreateTeamMemberOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private teamRoleRepository: ITeamRoleRepository,
    ){}

    async execute(input: CreateTeamMemberInputDTO): Promise<Result<CreateTeamMemberOutputDTO, ApplicationError>>{
        const { teamId, userId, roleId } = input;

        const roleExists = await this.teamRoleRepository.exists({ _id: roleId, team: teamId });
        if(!roleExists){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_ROLE_NOT_FOUND,
                'Team role not found'
            ));
        }

        // TODO: maybe this is more faster for check-team-membership
        const isAlreadyMember = await this.teamMemberRepository.exists({
            user: userId,
            team: teamId
        });

        if(isAlreadyMember){
            return Result.fail(new ApplicationError(
                ErrorCodes.TEAM_MEMBER_ALREADY_EXISTS,
                'Team member already exists'
            ));
        }

        const newMember = await this.teamMemberRepository.create({
            user: userId,
            team: teamId,
            role: roleId,
            createdAt: new Date(),
            joinedAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok(newMember.props);
    }
}