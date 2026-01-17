import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import RevokeSessionUseCase from '../../../application/use-cases/RevokeSessionUseCase';

@injectable()
export default class RevokeSessionController extends BaseController<RevokeSessionUseCase> {
    constructor(
        @inject(RevokeSessionUseCase) useCase: RevokeSessionUseCase
    ) {
        super(useCase);
    }
};