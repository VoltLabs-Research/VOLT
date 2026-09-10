import Controller, { Middleware } from '@shared/http/Controller';
import { Route } from '@shared/http/route';
import { Query, CurrentUser } from '@shared/http/params';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import notificationService from '@modules/notification/services/NotificationService';
import { notificationRoutes } from '@volt/contracts/modules/notification/routes';

@Middleware(protect)
export default class NotificationController extends Controller {
    @Route(notificationRoutes.list)
    list(
        @CurrentUser() userId: string,
        @Query() query: Record<string, string>
    ){
        return notificationService.getMyNotifications({
            userId,
            page: query.page ? Number(query.page) : undefined,
            limit: query.limit ? Number(query.limit) : undefined
        });
    }

    @Route(notificationRoutes.markAllRead)
    async markAllRead(@CurrentUser() userId: string) {
        await notificationService.markAllAsRead(userId);
    }
}
