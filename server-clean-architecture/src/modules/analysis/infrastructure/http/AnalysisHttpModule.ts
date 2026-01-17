import analysisRoutes from './routes/analysis-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const AnalysisHttpModule: HttpModule = {
    basePath: '/api/analyses',
    router: analysisRoutes
};
