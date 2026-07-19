import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Query, CurrentUser } from '@shared/http/params';
import { protect } from '@modules/auth/middlewares/authentication';
import NotificationService from '@modules/notification/services/NotificationService';
import { notificationRoutes } from '@volt/contracts/modules/notification/routes';

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
