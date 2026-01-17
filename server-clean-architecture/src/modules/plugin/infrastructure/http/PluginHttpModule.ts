import pluginRoutes from './routes/plugin-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const PluginHttpModule: HttpModule = {
    basePath: '/api/plugins',
    router: pluginRoutes
};
