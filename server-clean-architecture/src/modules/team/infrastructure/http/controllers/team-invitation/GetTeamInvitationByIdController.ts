import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/GetTeamInvitationByIdUseCase';

@injectable()
export default class GetTeamInvitationByIdController extends BaseController<GetTeamInvitationByIdUseCase> {
    constructor(
        @inject(GetTeamInvitationByIdUseCase) useCase: GetTeamInvitationByIdUseCase
    ) {
        super(useCase);
    }
};