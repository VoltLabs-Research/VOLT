import { Result } from "@/src/shared/domain/ports/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { CreateTeamMemberInputDTO, CreateTeamMemberOutputDTO } from "../../dtos/team-member/CreateTeamMemberDTO";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { ITeamRoleRepository } from "../../../domain/ports/ITeamRoleRepository";
import { ITeamMemberRepository } from "../../../domain/ports/ITeamMemberRepository";

@injectable()
export default class CreateTeamMemberUseCase implements IUseCase<CreateTeamMemberInputDTO, CreateTeamMemberOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRoleRepository)
        private teamRoleRepository: ITeamRoleRepository
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