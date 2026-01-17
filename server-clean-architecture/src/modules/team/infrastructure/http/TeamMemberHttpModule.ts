import teamMemberRouter from './routes/team-member-router';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const TeamMemberHttpModule: HttpModule = {
    basePath: '/api/team-member',
    router: teamMemberRouter
};
