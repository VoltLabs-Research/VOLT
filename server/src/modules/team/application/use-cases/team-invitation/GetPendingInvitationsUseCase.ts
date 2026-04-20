import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { GetPendingInvitationsInputDTO, GetPendingInvitationsOutputDTO } from '@modules/team/application/dtos/team-invitation/GetPendingInvitationsDTO';
import { TeamInvitationStatus } from '@modules/team/domain/entities/team-invitation/TeamInvitation';
import { ITeamInvitationRepository } from '@modules/team/domain/port/team-invitation/ITeamInvitationRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class GetPendingInvitationsUseCase implements IUseCase<GetPendingInvitationsInputDTO, GetPendingInvitationsOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository
    ){}

    async execute(input: GetPendingInvitationsInputDTO): Promise<Result<GetPendingInvitationsOutputDTO, ApplicationError>> {
        const { teamId } = input;

        const results = await this.invitationRepository.findAll({
            filter: {
                team: teamId,
                status: TeamInvitationStatus.Pending
            },
            populate: {
                path: 'invitedUser'
            },
            page: input.page,
            limit: input.limit
        });

        return Result.ok({
            ...results,
            data: results.data.map((invitation) => ({
                _id: invitation._id,
                ...invitation.props
            }))
        });
    }
};
