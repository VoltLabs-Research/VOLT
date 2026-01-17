import dailyActivityRoutes from './routes/daily-activity-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const DailyActivityHttpModule: HttpModule = {
    basePath: '/api/daily-activities',
    router: dailyActivityRoutes
};
