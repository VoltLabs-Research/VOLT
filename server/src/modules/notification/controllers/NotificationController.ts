import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Query, CurrentUser } from '@shared/http/params';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import NotificationService from '@modules/notification/services/NotificationService';
import { notificationRoutes } from '@volt/contracts/modules/notification/routes';

/**
 * The single HTTP controller for the notification module (pollium style): every
 * route is bound with `@Route(notificationRoutes.x)` and delegates to a
 * {@link NotificationService} the controller `new`s itself. The class-level
 * `@Middleware(protect)` replaces the old `createHttpModule({ protected: true })`
 * auth layer (notification is user-scoped, not team-scoped). `list` returns a
 * paginated result (`Controller.#respond` detects it and emits the paginated
 * envelope); `markAllRead` returns nothing → 204, preserving the old NoContent.
 */
@Middleware(protect)
export default class NotificationController extends Controller {
    #service = new NotificationService();

    @Route(notificationRoutes.list)
    list(@CurrentUser() userId: string, @Query() query: Record<string, string>) {
        return this.#service.getMyNotifications({
            userId,
            page: query.page ? Number(query.page) : undefined,
            limit: query.limit ? Number(query.limit) : undefined
        });
    }

    @Route(notificationRoutes.markAllRead)
    async markAllRead(@CurrentUser() userId: string) {
        await this.#service.markAllAsRead(userId);
    }
}
