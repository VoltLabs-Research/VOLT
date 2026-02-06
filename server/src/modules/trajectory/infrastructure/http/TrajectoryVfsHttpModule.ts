import vfsRoutes from './routes/vfs-routes';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

export const TrajectoryVfsHttpModule: HttpModule = {
    basePath: '/api/trajectory-vfs',
    router: vfsRoutes
};
