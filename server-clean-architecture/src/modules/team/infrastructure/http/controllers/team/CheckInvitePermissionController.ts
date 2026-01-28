import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import CheckInvitePermissionUseCase from '@modules/team/application/use-cases/team/CheckInvitePermissionUseCase';

@injectable()
export default class CheckInvitePermissionController extends BaseController<CheckInvitePermissionUseCase> {
    constructor(
        @inject(CheckInvitePermissionUseCase) useCase: CheckInvitePermissionUseCase
    ) {
        super(useCase);
    }
};
