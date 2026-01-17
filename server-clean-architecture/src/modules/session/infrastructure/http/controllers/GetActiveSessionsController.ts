import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetActiveSessionsUseCase from '../../../application/use-cases/GetActiveSessionsUseCase';

@injectable()
export default class GetActiveSessionsController extends BaseController<GetActiveSessionsUseCase> {
    constructor(
        @inject(GetActiveSessionsUseCase) useCase: GetActiveSessionsUseCase
    ) {
        super(useCase);
    }
};