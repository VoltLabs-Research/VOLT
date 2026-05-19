import { Action } from '@core/constants/permissions';
import { ErrorCodes } from '@core/constants/error-codes';
import { checkTeamMembership } from '@modules/team/infrastructure/http/middlewares/check-team-membership';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import AIConversationHttpModule from '@modules/ai/infrastructure/http/routes/ai-conversation-routes';
import LatexHttpModule from '@modules/latex/infrastructure/http/routes/latex-routes';
import WhiteboardHttpModule from '@modules/whiteboards/infrastructure/http/routes/whiteboard-routes';
import AnalysisHttpModule from '@modules/analysis/infrastructure/http/routes/analysis-routes';
import AuthHttpModule from '@modules/auth/infrastructure/http/routes/auth-routes';
import ChatMessageHttpModule from '@modules/chat/infrastructure/http/routes/chat-message/chat-message-routes';
import ChatHttpModule from '@modules/chat/infrastructure/http/routes/chat/chat-routes';
import ContainerHttpModule from '@modules/container/infrastructure/http/routes/container-routes';
import DashboardHttpModule from '@modules/dashboard/infrastructure/http/routes/dashboard-routes';
import DailyActivityHttpModule from '@modules/daily-activity/infrastructure/http/routes/daily-activity-routes';
import EarlyAccessHttpModule from '@modules/early-access/infrastructure/http/routes/early-access-routes';
import NotificationHttpModule from '@modules/notification/infrastructure/http/routes/notification-routes';
import PluginExposureHttpModule from '@modules/plugin/infrastructure/http/routes/exposure';
import PluginListingRowHttpModule from '@modules/plugin/infrastructure/http/routes/listing-row';
import PluginHttpModule from '@modules/plugin/infrastructure/http/routes/plugin';
import RasterHttpModule from '@modules/raster/infrastructure/http/routes/raster-routes';
import SessionHttpModule from '@modules/session/infrastructure/http/routes/session-routes';
import ScriptingHttpModule from '@modules/scripting/infrastructure/http/routes/scripting-routes';
import ScriptingJupyterHttpModule from '@modules/scripting/infrastructure/http/routes/scripting-jupyter-routes';
import SimulationCellHttpModule from '@modules/simulation-cell/infrastructure/http/routes/simulation-cell-routes';
import SystemHttpModule from '@modules/system/infrastructure/http/routes/system-routes';
import JobsHttpModule from '@modules/jobs/infrastructure/http/routes/jobs-routes';
import TeamAIIntegrationHttpModule from '@modules/team/infrastructure/http/routes/ai-integration';
import TeamInvitationPublicHttpModule from '@modules/team/infrastructure/http/routes/team-invitation/public';
import TeamInvitationHttpModule from '@modules/team/infrastructure/http/routes/team-invitation';
import TeamMemberHttpModule from '@modules/team/infrastructure/http/routes/team-member';
import TeamRoleHttpModule from '@modules/team/infrastructure/http/routes/team-role';
import TeamSecretKeySelfHttpModule from '@modules/team/infrastructure/http/routes/secret-key/self';
import TeamSecretKeyHttpModule from '@modules/team/infrastructure/http/routes/secret-key';
import TeamSelfHttpModule from '@modules/team/infrastructure/http/routes/team/self';
import TeamHttpModule from '@modules/team/infrastructure/http/routes/team';
import TeamClusterHttpModule from '@modules/cluster/infrastructure/http/routes/team-cluster-routes';
import TeamClusterObjectStoreProxyHttpModule from '@modules/cluster/infrastructure/http/routes/team-cluster-object-store-proxy-routes';
import TeamClusterLifecycleHttpModule from '@modules/cluster/infrastructure/http/routes/team-cluster-lifecycle-routes';
import ClusterObjectHttpModule from '@modules/cluster/infrastructure/http/routes/cluster-object-routes';
import ColorCodingHttpModule from '@modules/trajectory/infrastructure/http/routes/color-coding';
import CanvasHttpModule from '@modules/trajectory/infrastructure/http/routes/canvas';
import DiscoverHttpModule from '@modules/trajectory/infrastructure/http/routes/discover';
import ParticleFilterHttpModule from '@modules/trajectory/infrastructure/http/routes/particle-filter';
import TrajectoryHttpModule from '@modules/trajectory/infrastructure/http/routes/trajectory';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { Router } from 'express';
import type {
    NextFunction,
    RequestHandler,
    RequestParamHandler,
    Response
} from 'express';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import type { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

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
    TeamClusterHttpModule,
    ClusterObjectHttpModule,
    TeamClusterObjectStoreProxyHttpModule,
    TeamClusterLifecycleHttpModule,
    DashboardHttpModule,
    ChatHttpModule,
    ChatMessageHttpModule,
    NotificationHttpModule,
    EarlyAccessHttpModule,
    PluginListingRowHttpModule,
    PluginExposureHttpModule,
    ScriptingHttpModule,
    ScriptingJupyterHttpModule,
    ContainerHttpModule,
    TrajectoryHttpModule,
    JobsHttpModule,
    AnalysisHttpModule,
    PluginHttpModule,
    RasterHttpModule,
    SimulationCellHttpModule,
    DailyActivityHttpModule,
    SystemHttpModule,
    DiscoverHttpModule,
    CanvasHttpModule,
    ColorCodingHttpModule,
    ParticleFilterHttpModule,
    AIConversationHttpModule,
    LatexHttpModule,
    WhiteboardHttpModule
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
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
    resource?: string
): void => {
    checkTeamMembership(req, res, () => {
        if (!resource) {
            next();
            return;
        }

        const action = METHOD_ACTION_MAP[req.method] || Action.READ;
        const permission = `${resource}:${action}`;
        const permissions = req.teamPermissions || [];

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

const mountModule = (rootRouter: Router, module: HttpModule): void => {
    const startedAt = Date.now();
    const teamScope = module.teamScope ?? null;

    if (teamScope === HttpModuleTeamScope.BasePath) {
        const middleware: RequestHandler[] = [];

        if (module.protected) {
            middleware.push(protect);
        }

        middleware.push((req: AuthenticatedRequest, res: Response, next: NextFunction) => {
            enforceTeamAccess(req, res, next, module.resource);
        });

        rootRouter.use(module.basePath, ...middleware, module.router);
        logger.debug(`@http-bootstrap: module-mounted basePath=${module.basePath} resource=${module.resource} teamScope=${teamScope} durationMs=${Date.now() - startedAt}`);
        return;
    }

    if (teamScope === HttpModuleTeamScope.Param) {
        const teamParamHandler: RequestParamHandler = (
            req: AuthenticatedRequest,
            res: Response,
            next: NextFunction,
            _value: string,
            _name: string
        ) => {
            enforceTeamAccess(req, res, next, module.resource);
        };

        module.router.param('teamId', teamParamHandler);
    }

    rootRouter.use(module.basePath, module.router);

    logger.debug(`@http-bootstrap: module-mounted basePath=${module.basePath} resource=${module.resource} teamScope=${teamScope} durationMs=${Date.now() - startedAt}`);
};

const mountHttpRoutes = (): Router => {
    const startedAt = Date.now();
    const router = Router();

    assertUniqueModuleBasePaths(HTTP_MODULES);

    for (const module of HTTP_MODULES) {
        mountModule(router, module);
    }

    logger.info(`@http-bootstrap: mounted-routes moduleCount=${HTTP_MODULES.length} durationMs=${Date.now() - startedAt}`);

    return router;
};

export default mountHttpRoutes;
