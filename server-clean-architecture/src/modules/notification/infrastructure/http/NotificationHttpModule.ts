import notificationRoutes from './routes/notification-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const NotificationHttpModule: HttpModule = {
    basePath: '/api/notifications',
    router: notificationRoutes
};
