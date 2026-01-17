import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetPendingInvitationsUseCase from '@/src/modules/team/application/use-cases/team-invitation/GetPendingInvitationsUseCase';

@injectable()
export default class GetPendingInvitationsController extends BaseController<GetPendingInvitationsUseCase> {
    constructor(
        @inject(GetPendingInvitationsUseCase)
        useCase: GetPendingInvitationsUseCase
    ) {
        super(useCase);
    }
};