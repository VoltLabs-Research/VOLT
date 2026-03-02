import { Router, Response, NextFunction } from 'express';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';
import { Action } from '@core/constants/permissions';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '@modules/team/infrastructure/http/middlewares/check-team-membership';
import BaseResponse from '@shared/infrastructure/http/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/HttpStatus';
import AuthHttpModule from '@modules/auth/infrastructure/http/routes/auth-routes';
import SessionHttpModule from '@modules/session/infrastructure/http/routers/session-routes';
import TeamHttpModule from '@modules/team/infrastructure/http/routes/team-router';
import TeamMemberHttpModule from '@modules/team/infrastructure/http/routes/team-member-router';
import TeamInvitationHttpModule from '@modules/team/infrastructure/http/routes/team-invitation-router';
import TeamRoleHttpModule from '@modules/team/infrastructure/http/routes/team-role-router';
import TeamSecretKeyHttpModule from '@modules/team/infrastructure/http/routes/team-secret-key-router';
import TeamAIIntegrationHttpModule from '@modules/team/infrastructure/http/routes/team-ai-integration-router';
import ChatHttpModule from '@modules/chat/infrastructure/http/routes/chat-routes';
import ChatMessageHttpModule from '@modules/chat/infrastructure/http/routes/chat-message-routes';
import NotificationHttpModule from '@modules/notification/infrastructure/http/routes/notification-routes';
import SshConnectionHttpModule from '@modules/ssh/infrastructure/http/routes/ssh-connection-routes';
import ContainerHttpModule from '@modules/container/infrastructure/http/routes/container-routes';
import TrajectoryHttpModule from '@modules/trajectory/infrastructure/http/routes/trajectory-routes';
import TrajectoryJobsHttpModule from '@modules/jobs/infrastructure/http/routes/trajectory-jobs-routes';
import ColorCodingHttpModule from '@modules/trajectory/infrastructure/http/routes/color-coding-routes';
import ParticleFilterHttpModule from '@modules/trajectory/infrastructure/http/routes/particle-filter-routes';
import AnalysisHttpModule from '@modules/analysis/infrastructure/http/routes/analysis-routes';
import PluginHttpModule from '@modules/plugin/infrastructure/http/routes/plugin-routes';
import PluginListingHttpModule from '@modules/plugin/infrastructure/http/routes/listing-routes';
import PluginExposureHttpModule from '@modules/plugin/infrastructure/http/routes/exposure-routes';
import PluginScriptingHttpModule from '@modules/scripting/infrastructure/http/routes/scripting-routes';
import RasterHttpModule from '@modules/raster/infrastructure/http/routes/raster-routes';
import SimulationCellHttpModule from '@modules/simulation-cell/infrastructure/http/routes/simulation-cell-routes';
import DailyActivityHttpModule from '@modules/daily-activity/infrastructure/http/routes/daily-activity-routes';
import ApiTrackerHttpModule from '@modules/api-tracker/infrastructure/http/routes/api-tracker-routes';
import SystemHttpModule from '@modules/system/infrastructure/http/routes/system-routes';
import AIConversationHttpModule from '@modules/ai/infrastructure/http/routes/ai-conversation-routes';

/**
 * Maps HTTP methods to RBAC actions.
 */
const METHOD_ACTION_MAP: Record<string, Action> = {
    'GET': Action.READ,
    'HEAD': Action.READ,
    'POST': Action.CREATE,
    'PUT': Action.UPDATE,
    'PATCH': Action.UPDATE,
    'DELETE': Action.DELETE
};

const HTTP_MODULES: HttpModule[] = [
    AuthHttpModule,
    SessionHttpModule,
    TeamHttpModule,
    TeamMemberHttpModule,
    TeamInvitationHttpModule,
    TeamRoleHttpModule,
    TeamSecretKeyHttpModule,
    TeamAIIntegrationHttpModule,
    ChatHttpModule,
    ChatMessageHttpModule,
    NotificationHttpModule,
    PluginListingHttpModule,
    PluginExposureHttpModule,
    PluginScriptingHttpModule,
    SshConnectionHttpModule,
    ContainerHttpModule,
    TrajectoryHttpModule,
    TrajectoryJobsHttpModule,
    AnalysisHttpModule,
    PluginHttpModule,
    RasterHttpModule,
    SimulationCellHttpModule,
    DailyActivityHttpModule,
    ApiTrackerHttpModule,
    SystemHttpModule,
    ColorCodingHttpModule,
    ParticleFilterHttpModule,
    AIConversationHttpModule
];

const createTeamParamHandler = (resource?: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        checkTeamMembership(req, res, () => {
            if (!resource) return next();

            const action = METHOD_ACTION_MAP[req.method] || Action.READ;
            const permission = `${resource}:${action}`;
            const permissions = req.teamPermissions || [];

            if (permissions.includes('*') || permissions.includes(permission)) {
                return next();
            }

            return BaseResponse.error(
                res,
                `Missing permission: ${permission}`,
                HttpStatus.Forbidden,
                'RBAC::InsufficientPermissions'
            );
        });
    };
};

/**
 * Mount all module routes on the Express app.
 *
 * For each module:
 * 1. Registers a combined teamId param handler (membership + RBAC)
 * 2. Mounts the module's router at its basePath
 */
const mountHttpRoutes = (): Router => {
    const router = Router();

    for (const module of HTTP_MODULES) {
        module.router.param('teamId', createTeamParamHandler(module.resource));
        router.use(module.basePath, module.router);
    }

    return router;
};

export default mountHttpRoutes;
