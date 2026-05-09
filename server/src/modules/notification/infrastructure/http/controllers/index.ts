import {
    GetMyNotificationsUseCase,
    MarkAllMyNotificationsAsReadUseCase
} from '@modules/notification/application/use-cases';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import {
    createController,
    createPaginatedController
} from '@shared/infrastructure/http/controllers/createController';

const withAuthenticatedUserId = (request: { userId?: string }, params: Record<string, unknown>) => ({
    ...params,
    userId: request.userId
});

const GetMyNotificationsController = createPaginatedController(GetMyNotificationsUseCase, {
    extendParams: withAuthenticatedUserId
});
const MarkAllMyNotificationsAsReadController = createController(MarkAllMyNotificationsAsReadUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: withAuthenticatedUserId
});

export default createControllerRegistry({
    getMyNotifications: GetMyNotificationsController,
    markAllAsRead: MarkAllMyNotificationsAsReadController
});
