import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { GetPendingInvitationsInputDTO, GetPendingInvitationsOutputDTO } from '../../dtos/team-invitation/GetPendingInvitationsDTO';
import { TeamInvitationStatus } from '../../../domain/entities/TeamInvitation';

@injectable()
export default class GetPendingInvitationsUseCase implements IUseCase<GetPendingInvitationsInputDTO, GetPendingInvitationsOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private readonly invitationRepository: ITeamInvitationRepository
    ) { }

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
            page: 1,
            limit: 100 
        });

        return Result.ok({
            ...results,
            data: results.data.map(a => a.props)
        });
    }
}
