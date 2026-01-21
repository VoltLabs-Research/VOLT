import { Router } from 'express';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import AuthHttpModule from '@modules/auth/infrastructure/http/routes/auth-routes';
import SessionHttpModule from '@modules/session/infrastructure/http/routers/session-routes';
import TeamHttpModule from '@modules/team/infrastructure/http/routes/team-router';
import TeamMemberHttpModule from '@modules/team/infrastructure/http/routes/team-member-router';
import TeamInvitationHttpModule from '@modules/team/infrastructure/http/routes/team-invitation-router';
import TeamRoleHttpModule from '@modules/team/infrastructure/http/routes/team-role-router';
import ChatHttpModule from '@modules/chat/infrastructure/http/routes/chat-routes';
import ChatMessageHttpModule from '@modules/chat/infrastructure/http/routes/chat-message-routes';
import NotificationHttpModule from '@modules/notification/infrastructure/http/routes/notification-routes';
import SshConnectionHttpModule from '@modules/ssh/infrastructure/http/routes/ssh-connection-routes';
import ContainerHttpModule from '@modules/container/infrastructure/http/routes/container-routes';
import TrajectoryHttpModule from '@modules/trajectory/infrastructure/http/routes/trajectory-routes';
import ColorCodingHttpModule from '@modules/trajectory/infrastructure/http/routes/color-coding-routes';
import ParticleFilterHttpModule from '@modules/trajectory/infrastructure/http/routes/particle-filter-routes';
import AnalysisHttpModule from '@modules/analysis/infrastructure/http/routes/analysis-routes';
import PluginHttpModule from '@modules/plugin/infrastructure/http/routes/plugin-routes';
import PluginListingHttpModule from '@modules/plugin/infrastructure/http/routes/listing-routes';
import PluginExposureHttpModule from '@modules/plugin/infrastructure/http/routes/exposure-routes';
import RasterHttpModule from '@modules/raster/infrastructure/http/routes/raster-routes';
import SimulationCellHttpModule from '@modules/simulation-cell/infrastructure/http/routes/simulation-cell-routes';
import DailyActivityHttpModule from '@modules/daily-activity/infrastructure/http/routes/daily-activity-routes';
import ApiTrackerHttpModule from '@modules/api-tracker/infrastructure/http/routes/api-tracker-routes';
import SystemHttpModule from '@modules/system/infrastructure/http/routes/system-routes';
import { checkTeamMembership } from '@modules/team/infrastructure/http/middlewares/check-team-membership';

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
    SystemHttpModule,
    ColorCodingHttpModule,
    ParticleFilterHttpModule
];

/**
 * Mount all module routes on the Express app.
 */
const mountHttpRoutes = (): Router => {
    const router = Router();

    for (const module of HTTP_MODULES) {
        module.router.param('teamId', checkTeamMembership);
        router.use(module.basePath, module.router);
    }

    return router;
};

export default mountHttpRoutes;