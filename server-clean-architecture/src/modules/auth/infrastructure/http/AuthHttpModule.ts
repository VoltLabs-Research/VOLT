import authRoutes from './routes/auth-routes';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const AuthHttpModule: HttpModule = {
    basePath: '/api/auth',
    router: authRoutes
};
