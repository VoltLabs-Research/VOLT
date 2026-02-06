import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetGuestIdentityUseCase from '@modules/auth/application/use-cases/GetGuestIdentityUseCase';

@injectable()
export default class GetGuestIdentityController extends BaseController<GetGuestIdentityUseCase> {
    constructor(
        @inject(GetGuestIdentityUseCase) useCase: GetGuestIdentityUseCase
    ) {
        super(useCase);
    }
};