import { Result } from "@/src/shared/domain/Result";
import { IUseCase } from "@/src/shared/application/IUseCase";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from "../../../infrastructure/di/TeamTokens";
import TeamMemberRepository from "../../../infrastructure/persistence/mongo/repositories/TeamMemberRepository";
import { ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO } from "../../dtos/team-member/ListTeamMembersByTeamIdDTO";

@injectable()
export default class ListTeamMembersByTeamIdUseCase implements IUseCase<ListTeamMembersByTeamIdInputDTO, ListTeamMembersByTeamIdOutputDTO, ApplicationError>{
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private teamMemberRepository: TeamMemberRepository
    ){}

    async execute(input: ListTeamMembersByTeamIdInputDTO): Promise<Result<ListTeamMembersByTeamIdOutputDTO, ApplicationError>>{
        const { teamId } = input;
        const teamMembers = await this.teamMemberRepository.findAll({ filter: { team: teamId }, page: 1, limit: 100 });

        return Result.ok(teamMembers);
    }
}