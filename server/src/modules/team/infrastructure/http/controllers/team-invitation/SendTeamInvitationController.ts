import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import SendTeamInvitationUseCase from '@modules/team/application/use-cases/team-invitation/SendTeamInvitationUseCase';

@injectable()
export default class SendTeamInvitationController extends BaseController<SendTeamInvitationUseCase> {
    constructor(
        @inject(SendTeamInvitationUseCase) 
        useCase: SendTeamInvitationUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};