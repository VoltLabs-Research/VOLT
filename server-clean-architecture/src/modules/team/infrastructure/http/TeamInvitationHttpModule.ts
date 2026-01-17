import teamInvitationRouter from './routes/team-invitation-router';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

export const TeamInvitationHttpModule: HttpModule = {
    basePath: '/api/team/invitations',
    router: teamInvitationRouter
};
