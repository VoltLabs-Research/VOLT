import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import UpdateTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/UpdateTeamInvitationByIdUseCase';

@injectable()
export default class UpdateTeamInvitationByIdController extends BaseController<UpdateTeamInvitationByIdUseCase> {
    constructor(
        @inject(UpdateTeamInvitationByIdUseCase) useCase: UpdateTeamInvitationByIdUseCase
    ) {
        super(useCase);
    }
};