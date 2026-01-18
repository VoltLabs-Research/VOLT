import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import GetNotificationsByUserIdUseCase from '@modules/notification/application/use-cases/GetNotificationsByUserIdUseCase';

@injectable()
export default class GetNotificationsByUserIdController extends BaseController<GetNotificationsByUserIdUseCase> {
    constructor(
        @inject(GetNotificationsByUserIdUseCase) useCase: GetNotificationsByUserIdUseCase
    ) {
        super(useCase);
    }
};