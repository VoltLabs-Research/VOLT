import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import ListTeamInvitationsUseCase from '@/src/modules/team/application/use-cases/team-invitation/ListTeamInvitationsUseCase';

@injectable()
export default class ListTeamInvitationsByTeamIdController extends BaseController<ListTeamInvitationsUseCase> {
    constructor(
        @inject(ListTeamInvitationsUseCase) useCase: ListTeamInvitationsUseCase
    ) {
        super(useCase);
    }
};