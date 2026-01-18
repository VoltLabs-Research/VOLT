import { Router } from 'express';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';
import AuthHttpModule from '@/src/modules/auth/infrastructure/http/routes/auth-routes';
import SessionHttpModule from '@/src/modules/session/infrastructure/http/routers/session-routes';
import TeamHttpModule from '@/src/modules/team/infrastructure/http/routes/team-router';
import TeamMemberHttpModule from '@/src/modules/team/infrastructure/http/routes/team-member-router';
import TeamInvitationHttpModule from '@/src/modules/team/infrastructure/http/routes/team-invitation-router';
import TeamRoleHttpModule from '@/src/modules/team/infrastructure/http/routes/team-role-router';
import ChatHttpModule from '@/src/modules/chat/infrastructure/http/routes/chat-routes';
import ChatMessageHttpModule from '@/src/modules/chat/infrastructure/http/routes/chat-message-routes';
import NotificationHttpModule from '@/src/modules/notification/infrastructure/http/routes/notification-routes';
import SshConnectionHttpModule from '@/src/modules/ssh/infrastructure/http/routes/ssh-connection-routes';
import ContainerHttpModule from '@/src/modules/container/infrastructure/http/routes/container-routes';
import TrajectoryHttpModule from '@/src/modules/trajectory/infrastructure/http/routes/trajectory-routes';
import AnalysisHttpModule from '@/src/modules/analysis/infrastructure/http/routes/analysis-routes';
import PluginHttpModule from '@/src/modules/plugin/infrastructure/http/routes/plugin-routes';
import PluginListingHttpModule from '@/src/modules/plugin/infrastructure/http/routes/listing-routes';
import PluginExposureHttpModule from '@/src/modules/plugin/infrastructure/http/routes/exposure-routes';
import RasterHttpModule from '@/src/modules/raster/infrastructure/http/routes/raster-routes';
import SimulationCellHttpModule from '@/src/modules/simulation-cell/infrastructure/http/routes/simulation-cell-routes';
import DailyActivityHttpModule from '@/src/modules/daily-activity/infrastructure/http/routes/daily-activity-routes';
import ApiTrackerHttpModule from '@/src/modules/api-tracker/infrastructure/http/routes/api-tracker-routes';
import SystemHttpModule from '@/src/modules/system/infrastructure/http/routes/system-routes';
import { checkTeamMembership } from '@/src/modules/team/infrastructure/http/middlewares/check-team-membership';

const HTTP_MODULES: HttpModule[] = [
    AuthHttpModule,
    SessionHttpModule,
    TeamHttpModule,
    TeamMemberHttpModule,
    TeamInvitationHttpModule,
    TeamRoleHttpModule,
    ChatHttpModule,
    ChatMessageHttpModule,
    NotificationHttpModule,
    PluginListingHttpModule,
    PluginExposureHttpModule,
    SshConnectionHttpModule,
    ContainerHttpModule,
    TrajectoryHttpModule,
    AnalysisHttpModule,
    PluginHttpModule,
    RasterHttpModule,
    SimulationCellHttpModule,
    DailyActivityHttpModule,
    ApiTrackerHttpModule,
    SystemHttpModule
];

/**
 * Mount all module routes on the Express app.
 */
const mountHttpRoutes = (): Router => {
    const router = Router();
    
    for(const module of HTTP_MODULES){
        module.router.param('teamId', checkTeamMembership);
        router.use(module.basePath, module.router);
    }

    return router;
};

export default mountHttpRoutes;