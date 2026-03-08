import { Router } from 'express';
import type {
    NextFunction,
    Request,
    RequestHandler,
    RequestParamHandler,
    Response
} from 'express';
import type { HttpModule, HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { Action } from '@core/constants/permissions';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '@modules/team/infrastructure/http/middlewares/check-team-membership';
import { ErrorCodes } from '@core/constants/error-codes';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import AuthHttpModule from '@modules/auth/infrastructure/http/routes/auth-routes';
import SessionHttpModule from '@modules/session/infrastructure/http/routes/session-routes';
import TeamHttpModule from '@modules/team/infrastructure/http/routes/team-router';
import TeamSelfHttpModule from '@modules/team/infrastructure/http/routes/team-self-router';
import TeamMemberHttpModule from '@modules/team/infrastructure/http/routes/team-member-router';
import TeamInvitationHttpModule from '@modules/team/infrastructure/http/routes/team-invitation-router';
import TeamInvitationPublicHttpModule from '@modules/team/infrastructure/http/routes/team-invitation-public-router';
import TeamRoleHttpModule from '@modules/team/infrastructure/http/routes/team-role-router';
import TeamSecretKeyHttpModule from '@modules/team/infrastructure/http/routes/team-secret-key-router';
import TeamSecretKeySelfHttpModule from '@modules/team/infrastructure/http/routes/team-secret-key-self-router';
import TeamAIIntegrationHttpModule from '@modules/team/infrastructure/http/routes/team-ai-integration-router';
import ChatHttpModule from '@modules/chat/infrastructure/http/routes/chat-routes';
import ChatMessageHttpModule from '@modules/chat/infrastructure/http/routes/chat-message-routes';
import NotificationHttpModule from '@modules/notification/infrastructure/http/routes/notification-routes';
import SshConnectionHttpModule from '@modules/ssh/infrastructure/http/routes/ssh-connection-routes';
import ContainerHttpModule from '@modules/container/infrastructure/http/routes/container-routes';
import TrajectoryHttpModule from '@modules/trajectory/infrastructure/http/routes/trajectory-routes';
import TrajectoryJobsHttpModule from '@modules/jobs/infrastructure/http/routes/team-jobs-routes';
import ColorCodingHttpModule from '@modules/trajectory/infrastructure/http/routes/color-coding-routes';
import ParticleFilterHttpModule from '@modules/trajectory/infrastructure/http/routes/particle-filter-routes';
import AnalysisHttpModule from '@modules/analysis/infrastructure/http/routes/analysis-routes';
import PluginHttpModule from '@modules/plugin/infrastructure/http/routes/plugin-routes';
import PluginListingHttpModule from '@modules/plugin/infrastructure/http/routes/listing-routes';
import PluginExposureHttpModule from '@modules/plugin/infrastructure/http/routes/exposure-routes';
import ScriptingHttpModule from '@modules/scripting/infrastructure/http/routes/scripting-routes';
import RasterHttpModule from '@modules/raster/infrastructure/http/routes/raster-routes';
import SimulationCellHttpModule from '@modules/simulation-cell/infrastructure/http/routes/simulation-cell-routes';
import DailyActivityHttpModule from '@modules/daily-activity/infrastructure/http/routes/daily-activity-routes';
import SystemHttpModule from '@modules/system/infrastructure/http/routes/system-routes';
import AIConversationHttpModule from '@modules/ai/infrastructure/http/routes/ai-conversation-routes';

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
    TeamSelfHttpModule,
    TeamHttpModule,
    TeamMemberHttpModule,
    TeamInvitationHttpModule,
    TeamInvitationPublicHttpModule,
    TeamRoleHttpModule,
    TeamSecretKeyHttpModule,
    TeamSecretKeySelfHttpModule,
    TeamAIIntegrationHttpModule,
    ChatHttpModule,
    ChatMessageHttpModule,
    NotificationHttpModule,
    PluginListingHttpModule,
    PluginExposureHttpModule,
    ScriptingHttpModule,
    SshConnectionHttpModule,
    ContainerHttpModule,
    TrajectoryHttpModule,
    TrajectoryJobsHttpModule,
    AnalysisHttpModule,
    PluginHttpModule,
    RasterHttpModule,
    SimulationCellHttpModule,
    DailyActivityHttpModule,
    SystemHttpModule,
    ColorCodingHttpModule,
    ParticleFilterHttpModule,
    AIConversationHttpModule
];

const assertUniqueModuleBasePaths = (modules: HttpModule[]): void => {
    const basePathResources = new Map<string, string | undefined>();

    for (const module of modules) {
        const registeredResource = basePathResources.get(module.basePath);

        if (registeredResource && registeredResource !== module.resource) {
            throw new Error(
                `Conflicting HTTP module base path detected: ${module.basePath}`
            );
        }

        basePathResources.set(module.basePath, module.resource);
    }
};

const enforceTeamAccess = (
    req: Request,
    res: Response,
    next: NextFunction,
    resource?: string
): void => {
    const authenticatedRequest = req as AuthenticatedRequest;

    checkTeamMembership(authenticatedRequest, res, () => {
        if (!resource) {
            next();
            return;
        }

        const action = METHOD_ACTION_MAP[req.method] || Action.READ;
        const permission = `${resource}:${action}`;
        const permissions = authenticatedRequest.teamPermissions as string[];

        if (permissions.includes('*') || permissions.includes(permission)) {
            next();
            return;
        }

        BaseResponse.error(
            res,
            `Missing permission: ${permission}`,
            HttpStatus.Forbidden,
            ErrorCodes.RBAC_INSUFFICIENT_PERMISSIONS
        );
    });
};

const createTeamAccessMiddleware = (resource?: string): RequestHandler => {
    return (req, res, next) => {
        enforceTeamAccess(req, res, next, resource);
    };
};

const createTeamParamHandler = (resource?: string): RequestParamHandler => {
    return (req, res, next) => {
        enforceTeamAccess(req, res, next, resource);
    };
};

const resolveTeamScope = (module: HttpModule): HttpModuleTeamScope | null => {
    if (module.teamScope) {
        return module.teamScope;
    }

    return module.basePath.includes(':teamId') ? 'base-path' : null;
};

const mountModule = (rootRouter: Router, module: HttpModule): void => {
    const teamScope = resolveTeamScope(module);

    if (teamScope === 'base-path') {
        rootRouter.use(module.basePath, protect, createTeamAccessMiddleware(module.resource), module.router);
        return;
    }

    if (teamScope === 'param') {
        module.router.param('teamId', createTeamParamHandler(module.resource));
    }

    rootRouter.use(module.basePath, module.router);
};

const mountHttpRoutes = (): Router => {
    const router = Router();

    assertUniqueModuleBasePaths(HTTP_MODULES);

    for (const module of HTTP_MODULES) {
        mountModule(router, module);
    }

    return router;
};

export default mountHttpRoutes;
