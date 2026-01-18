import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import DeleteTeamInvitationByIdUseCase from '@modules/team/application/use-cases/team-invitation/DeleteTeamInvitationByIdUseCase';

@injectable()
export default class DeleteTeamInvitationByIdController extends BaseController<DeleteTeamInvitationByIdUseCase> {
    constructor(
        @inject(DeleteTeamInvitationByIdUseCase) useCase: DeleteTeamInvitationByIdUseCase
    ) {
        super(useCase, HttpStatus.Deleted);
    }
};