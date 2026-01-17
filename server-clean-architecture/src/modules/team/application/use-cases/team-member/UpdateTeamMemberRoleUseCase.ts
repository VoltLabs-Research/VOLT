import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@/src/core/constants/error-codes';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ITeamMemberRepository } from '../../../domain/ports/ITeamMemberRepository';
import { ITeamRepository } from '../../../domain/ports/ITeamRepository';
import { UpdateTeamMemberRoleInputDTO, UpdateTeamMemberRoleOutputDTO } from '../../dtos/team-member/UpdateTeamMemberRoleDTO';

@injectable()
export default class UpdateTeamMemberRoleUseCase implements IUseCase<UpdateTeamMemberRoleInputDTO, UpdateTeamMemberRoleOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamMemberRepository)
        private readonly teamMemberRepository: ITeamMemberRepository,
        @inject(TEAM_TOKENS.TeamRepository)
        private readonly teamRepository: ITeamRepository
    ) {}

    async execute(input: UpdateTeamMemberRoleInputDTO): Promise<Result<UpdateTeamMemberRoleOutputDTO, ApplicationError>> {
        const { teamMemberId, teamId, newRoleId } = input;

        const [currentMember, team] = await Promise.all([
            this.teamMemberRepository.findById(teamMemberId),
            this.teamRepository.findById(teamId)
        ]);

        if (!currentMember) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team member not found'
            ));
        }

        if (!team) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_NOT_FOUND,
                'Team not found'
            ));
        }

        if (team.isOwner(currentMember.props.user)) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_ROLE_IS_SYSTEM,
                'Cannot change role of team owner'
            ));
        }

        const updatedMember = await this.teamMemberRepository.updateById(teamMemberId, {
            role: newRoleId
        });

        if (!updatedMember) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Failed to update team member'
            ));
        }

        return Result.ok(updatedMember.props);
    }
}
