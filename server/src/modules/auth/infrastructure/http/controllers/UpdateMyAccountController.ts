import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import UpdateAccountUseCase from '@modules/auth/application/use-cases/UpdateAccountUseCase';

@injectable()
export default class UpdateMyAccountController extends BaseController<UpdateAccountUseCase> {
    constructor(
        @inject(UpdateAccountUseCase) useCase: UpdateAccountUseCase
    ) {
        super(useCase);
    }
};