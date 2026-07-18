import { Action } from '@core/constants/permissions';
import { ErrorCodes } from '@core/constants/error-codes';
import { checkTeamMembership } from '@modules/team/middlewares/check-team-membership';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import AIConversationHttpModule from '@modules/ai/routes/ai-conversation-routes';
import LatexHttpModule from '@modules/latex/routes/latex-routes';
import WhiteboardHttpModule from '@modules/whiteboards/routes/whiteboard-routes';
import AnalysisHttpModule from '@modules/analysis/routes/analysis-routes';
import ProvenanceHttpModule from '@modules/analysis/routes/provenance-routes';
import AuthHttpModule from '@modules/auth/routes/auth-routes';
import ChatMessageHttpModule from '@modules/chat/routes/chat-message/chat-message-routes';
import ChatHttpModule from '@modules/chat/routes/chat/chat-routes';
import ContainerHttpModule from '@modules/container/routes/container-routes';
import DashboardHttpModule from '@modules/dashboard/routes/dashboard-routes';
import DailyActivityHttpModule from '@modules/daily-activity/routes/daily-activity-routes';
import EarlyAccessHttpModule from '@modules/early-access/routes/early-access-routes';
import NotificationHttpModule from '@modules/notification/routes/notification-routes';
import PluginExposureHttpModule from '@modules/plugin/routes/exposure';
import PluginListingRowHttpModule from '@modules/plugin/routes/listing-row';
import PluginHttpModule from '@modules/plugin/routes/plugin';
import RasterHttpModule from '@modules/raster/routes/raster-routes';
import SessionHttpModule from '@modules/session/routes/session-routes';
import ScriptingHttpModule from '@modules/scripting/routes/scripting-routes';
import ScriptingJupyterHttpModule from '@modules/scripting/routes/scripting-jupyter-routes';
import SimulationCellHttpModule from '@modules/simulation-cell/routes/simulation-cell-routes';
import SystemHttpModule from '@modules/system/routes/system-routes';
import SystemConfigHttpModule from '@modules/system/routes/system-config-routes';
import JobsHttpModule from '@modules/jobs/routes/jobs-routes';
import TeamAIIntegrationHttpModule from '@modules/team/routes/ai-integration';
import TeamInvitationPublicHttpModule from '@modules/team/routes/team-invitation/public';
import TeamInvitationHttpModule from '@modules/team/routes/team-invitation';
import TeamMemberHttpModule from '@modules/team/routes/team-member';
import TeamRoleHttpModule from '@modules/team/routes/team-role';
import TeamSecretKeySelfHttpModule from '@modules/team/routes/secret-key/self';
import TeamSecretKeyHttpModule from '@modules/team/routes/secret-key';
import TeamSelfHttpModule from '@modules/team/routes/team/self';
import TeamHttpModule from '@modules/team/routes/team';
import TeamClusterHttpModule from '@modules/cluster/routes/team-cluster-routes';
import TeamClusterObjectStoreProxyHttpModule from '@modules/cluster/routes/team-cluster-object-store-proxy-routes';
import TeamClusterLifecycleHttpModule from '@modules/cluster/routes/team-cluster-lifecycle-routes';
import ClusterObjectHttpModule from '@modules/cluster/routes/cluster-object-routes';
import ColorCodingHttpModule from '@modules/trajectory/routes/color-coding';
import LineStyleHttpModule from '@modules/trajectory/routes/line-style';
import LodHttpModule from '@modules/trajectory/routes/lod';
import CanvasHttpModule from '@modules/trajectory/routes/canvas';
import DiscoverHttpModule from '@modules/trajectory/routes/discover';
import ParticleFilterHttpModule from '@modules/trajectory/routes/particle-filter';
import TrajectoryHttpModule from '@modules/trajectory/routes/trajectory';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { getEnabledModules } from '@core/bootstrap/module-state';
import { moduleRegistry } from '@shared/infrastructure/modules/ModuleRegistry';
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
    SystemConfigHttpModule,
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
    ProvenanceHttpModule,
    PluginHttpModule,
    RasterHttpModule,
    SimulationCellHttpModule,
    DailyActivityHttpModule,
    SystemHttpModule,
    DiscoverHttpModule,
    CanvasHttpModule,
    ColorCodingHttpModule,
    LineStyleHttpModule,
    LodHttpModule,
    ParticleFilterHttpModule,
    AIConversationHttpModule,
    LatexHttpModule,
    WhiteboardHttpModule
];

const resolveModuleKey = (module: HttpModule): string | undefined =>
    module.moduleKey;

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

    const enabled = getEnabledModules();

    const knownKeys = new Set(moduleRegistry.all().map((m) => m.key));
    for (const module of HTTP_MODULES) {
        if (module.moduleKey !== undefined && !knownKeys.has(module.moduleKey)) {
            throw new Error(`@http-bootstrap: route moduleKey "${module.moduleKey}" (basePath ${module.basePath}) is not a registered module`);
        }
    }

    const modulesToMount = HTTP_MODULES.filter((module) => {
        const key = resolveModuleKey(module);
        const allowed = key === undefined || enabled.has(key);
        if (!allowed) {
            logger.debug(`@http-bootstrap: skipping disabled module route basePath=${module.basePath} moduleKey=${key}`);
        }
        return allowed;
    });

    assertUniqueModuleBasePaths(modulesToMount);

    for (const module of modulesToMount) {
        mountModule(router, module);
    }

    logger.info(`@http-bootstrap: mounted-routes moduleCount=${modulesToMount.length} skipped=${HTTP_MODULES.length - modulesToMount.length} durationMs=${Date.now() - startedAt}`);

    return router;
};

export default mountHttpRoutes;
