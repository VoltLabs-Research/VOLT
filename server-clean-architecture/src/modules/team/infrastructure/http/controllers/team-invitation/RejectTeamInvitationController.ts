import { injectable, inject } from 'tsyringe';
import RejectTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/RejectTeamInvitationUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class RejectTeamInvitationController extends BaseController<RejectTeamInvitationUseCase> {
    constructor(
        @inject(RejectTeamInvitationUseCase)
        useCase: RejectTeamInvitationUseCase
    ) {
        super(useCase);
    }
}
