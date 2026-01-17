import simulationCellRoutes from './routes/simulation-cell-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const SimulationCellHttpModule: HttpModule = {
    basePath: '/api/simulation-cells',
    router: simulationCellRoutes
};
