import { injectable, inject } from 'tsyringe';
import { BaseController } from '@/src/shared/infrastructure/http/BaseController';
import GetNotificationsByUserIdUseCase from '../../../application/use-cases/GetNotificationsByUserIdUseCase';

@injectable()
export default class GetNotificationsByUserIdController extends BaseController<GetNotificationsByUserIdUseCase> {
    constructor(
        @inject(GetNotificationsByUserIdUseCase) useCase: GetNotificationsByUserIdUseCase
    ) {
        super(useCase);
    }
};