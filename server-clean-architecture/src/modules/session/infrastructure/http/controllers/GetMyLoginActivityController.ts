import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetLoginActivityUseCase from '@modules/session/application/use-cases/GetLoginActivityUseCase';

@injectable()
export default class GetMyLoginActivityController extends BaseController<GetLoginActivityUseCase> {
    constructor(
        @inject(GetLoginActivityUseCase) useCase: GetLoginActivityUseCase
    ) {
        super(useCase);
    }
};