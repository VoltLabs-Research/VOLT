import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { GetMyNotificationsUseCase } from '@modules/notification/application/use-cases';

export default createPaginatedController(GetMyNotificationsUseCase, {
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});
