import type NotificationService from '@modules/notification/application/NotificationService';
import type {
    GetMyNotificationsInputDTO,
    MarkAllMyNotificationsAsReadInputDTO
} from '@modules/notification/application/dtos';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

/**
 * The single HTTP controller for the notification module. One Express handler
 * per route, assembling the use-case input exactly as `buildControllerParams`
 * did for the generated controllers, delegating to {@link NotificationService},
 * and responding via {@link BaseResponse}. Handlers are arrow-function
 * properties so `this` stays bound when passed by reference to the router.
 * Thrown `ApplicationError`s propagate to `httpErrorMiddleware` via Express 5
 * async forwarding.
 */
@injectable()
export default class NotificationController {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationService) private readonly notificationService: NotificationService
    ) {}

    getMyNotifications = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetMyNotificationsInputDTO;
        const value = await this.notificationService.getMyNotifications(input);
        BaseResponse.paginated(res, value, value._meta);
    };

    markAllAsRead = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as MarkAllMyNotificationsAsReadInputDTO;
        await this.notificationService.markAllAsRead(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };
}
