import systemRoutes from './routes/system-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const SystemHttpModule: HttpModule = {
    basePath: '/api/system',
    router: systemRoutes
};
