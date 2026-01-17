import teamRoleRouter from './routes/team-role-router';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const TeamRoleHttpModule: HttpModule = {
    basePath: '/api/team/roles',
    router: teamRoleRouter
};
