import rasterRoutes from './routes/raster-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const RasterHttpModule: HttpModule = {
    basePath: '/api/raster',
    router: rasterRoutes
};
