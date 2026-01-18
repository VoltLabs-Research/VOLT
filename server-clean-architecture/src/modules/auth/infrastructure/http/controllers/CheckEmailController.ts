import { injectable, inject } from 'tsyringe';
import CheckEmailUseCase from '@modules/auth/application/use-cases/CheckEmailUseCase';
import { BaseController } from '@shared/infrastructure/http/BaseController';

@injectable()
export default class CheckEmailController extends BaseController<CheckEmailUseCase> {
    constructor(
        @inject(CheckEmailUseCase) useCase: CheckEmailUseCase
    ) {
        super(useCase);
    }
};