import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import { HttpStatus } from '@/src/shared/infrastructure/http/HttpStatus';
import SendTeamInvitationUseCase from '@/src/modules/team/application/use-cases/team-invitation/SendTeamInvitationUseCase';

@injectable()
export default class SendTeamInvitationController extends BaseController<SendTeamInvitationUseCase> {
    constructor(
        @inject(SendTeamInvitationUseCase) 
        useCase: SendTeamInvitationUseCase
    ) {
        super(useCase, HttpStatus.Created);
    }
};