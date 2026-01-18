import containerRoutes from './routes/container-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const ContainerHttpModule: HttpModule = {
    basePath: '/api/container',
    router: containerRoutes
};
