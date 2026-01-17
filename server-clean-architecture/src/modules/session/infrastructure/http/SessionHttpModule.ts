import sessionRoutes from './routers/session-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const SessionHttpModule: HttpModule = {
    basePath: '/api/sessions',
    router: sessionRoutes
};
