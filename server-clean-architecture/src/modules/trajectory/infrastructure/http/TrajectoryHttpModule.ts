import trajectoryRoutes from './routes/trajectory-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const TrajectoryHttpModule: HttpModule = {
    basePath: '/api/trajectories',
    router: trajectoryRoutes
};
