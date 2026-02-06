import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import RevokeSessionUseCase from '@modules/session/application/use-cases/RevokeSessionUseCase';

@injectable()
export default class RevokeSessionController extends BaseController<RevokeSessionUseCase> {
    constructor(
        @inject(RevokeSessionUseCase) useCase: RevokeSessionUseCase
    ) {
        super(useCase);
    }
};