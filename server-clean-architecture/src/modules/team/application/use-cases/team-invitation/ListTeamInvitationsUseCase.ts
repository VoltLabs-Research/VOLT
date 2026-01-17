import { Result } from '@/src/shared/domain/ports/Result';
import { IUseCase } from '@/src/shared/application/IUseCase';
import ApplicationError from '@/src/shared/application/errors/ApplicationErrors';
import { injectable, inject } from 'tsyringe';
import { TEAM_TOKENS } from '../../../infrastructure/di/TeamTokens';
import { ITeamInvitationRepository } from '../../../domain/ports/ITeamInvitationRepository';
import { ListTeamInvitationsInputDTO, ListTeamInvitationsOutputDTO } from '../../dtos/team-invitation/ListTeamInvitationsDTO';

@injectable()
export default class ListTeamInvitationsUseCase implements IUseCase<ListTeamInvitationsInputDTO, ListTeamInvitationsOutputDTO, ApplicationError> {
    constructor(
        @inject(TEAM_TOKENS.TeamInvitationRepository)
        private invitationRepo: ITeamInvitationRepository
    ) { }

    async execute(input: ListTeamInvitationsInputDTO): Promise<Result<ListTeamInvitationsOutputDTO, ApplicationError>> {
        const { teamId, status } = input;
        const results = await this.invitationRepo.findAll({
            filter: { team: teamId, status },
            limit: 100,
            page: 1
        });

        return Result.ok({
            ...results,
            data: results.data.map(inv => inv.props)
        });
    }
};