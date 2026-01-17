import apiTrackerRoutes from './routes/api-tracker-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const ApiTrackerHttpModule: HttpModule = {
    basePath: '/api/api-tracker',
    router: apiTrackerRoutes
};
