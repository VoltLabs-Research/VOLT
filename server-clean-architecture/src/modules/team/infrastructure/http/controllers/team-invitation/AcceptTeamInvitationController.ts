import { injectable, inject } from 'tsyringe';
import AcceptTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/AcceptTeamInvitationUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class AcceptTeamInvitationController extends BaseController<AcceptTeamInvitationUseCase> {
    constructor(
        @inject(AcceptTeamInvitationUseCase)
        useCase: AcceptTeamInvitationUseCase
    ) {
        super(useCase);
    }
}
