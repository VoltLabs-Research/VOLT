import teamRouter from './routes/team-router';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const TeamHttpModule: HttpModule = {
    basePath: '/api/teams',
    router: teamRouter
};
