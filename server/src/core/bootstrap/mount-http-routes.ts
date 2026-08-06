import { Router } from 'express';
import { getEnabledModules } from '@core/bootstrap/module-state';
import Controller from '@shared/http/Controller';
import logger from '@shared/infrastructure/logger';

import AuthController from '@modules/auth/controllers/AuthController';
import SessionController from '@modules/session/controllers/SessionController';
import NotificationController from '@modules/notification/controllers/NotificationController';
import SystemController from '@modules/system/controllers/SystemController';
import TeamController from '@modules/team/controllers/TeamController';
import TeamMemberController from '@modules/team/controllers/TeamMemberController';
import TeamRoleController from '@modules/team/controllers/TeamRoleController';
import TeamInvitationController from '@modules/team/controllers/TeamInvitationController';
import SecretKeyController from '@modules/team/controllers/SecretKeyController';
import TeamAIIntegrationController from '@modules/team/controllers/TeamAIIntegrationController';
import ClusterController from '@modules/cluster/controllers/ClusterController';
import ClusterLifecycleController from '@modules/cluster/controllers/ClusterLifecycleController';
import ClusterObjectController from '@modules/cluster/controllers/ClusterObjectController';
import ClusterObjectStoreProxyController from '@modules/cluster/controllers/ClusterObjectStoreProxyController';
import ContainerController from '@modules/container/controllers/ContainerController';
import TrajectoryController from '@modules/trajectory/controllers/TrajectoryController';
import CanvasController from '@modules/trajectory/controllers/CanvasController';
import DiscoverController from '@modules/trajectory/controllers/DiscoverController';
import PluginController from '@modules/plugin/controllers/PluginController';
import ScriptingController from '@modules/scripting/controllers/ScriptingController';
import JobsController from '@modules/jobs/controllers/JobsController';
import RasterController from '@modules/raster/controllers/RasterController';
import SimulationCellController from '@modules/simulation-cell/controllers/SimulationCellController';
import ChatController from '@modules/chat/controllers/ChatController';
import WhiteboardController from '@modules/whiteboards/controllers/WhiteboardController';
import AiController from '@modules/ai/controllers/AiController';
import AnalysisController from '@modules/analysis/controllers/AnalysisController';
import ProvenanceController from '@modules/analysis/controllers/ProvenanceController';
import DashboardController from '@modules/dashboard/controllers/DashboardController';
import DailyActivityController from '@modules/daily-activity/controllers/DailyActivityController';

type ControllerClass = new () => Controller;

type RouterProviderClass = new () => { buildRouter(): Router };

const CONTROLLERS: Readonly<Record<string, readonly ControllerClass[]>> = {
    system: [SystemController],
    auth: [AuthController],
    session: [SessionController],
    notification: [NotificationController],
    team: [
        TeamController,
        TeamMemberController,
        TeamRoleController,
        TeamInvitationController,
        SecretKeyController,
        TeamAIIntegrationController
    ],
    cluster: [ClusterController, ClusterLifecycleController, ClusterObjectController],
    container: [ContainerController],
    trajectory: [TrajectoryController, CanvasController, DiscoverController],
    plugin: [PluginController],
    scripting: [ScriptingController],
    jobs: [JobsController],
    raster: [RasterController],
    'simulation-cell': [SimulationCellController],
    chat: [ChatController],
    whiteboards: [WhiteboardController],
    ai: [AiController],
    analysis: [AnalysisController, ProvenanceController],
    dashboard: [DashboardController],
    'daily-activity': [DailyActivityController]
};

const LEGACY_ROUTER_PROVIDERS: Readonly<Record<string, readonly RouterProviderClass[]>> = {
    cluster: [ClusterObjectStoreProxyController]
};

const collectMountable = (enabled: Set<string>): RouterProviderClass[] => [
    ...Object.entries(CONTROLLERS),
    ...Object.entries(LEGACY_ROUTER_PROVIDERS)
]
    .filter(([moduleKey]) => enabled.has(moduleKey))
    .flatMap(([, classes]) => classes as readonly RouterProviderClass[]);

const countAll = (): number =>
    [...Object.values(CONTROLLERS), ...Object.values(LEGACY_ROUTER_PROVIDERS)]
        .reduce((count, classes) => count + classes.length, 0);

const mountHttpRoutes = (): Router => {
    const startedAt = Date.now();
    const router = Router();
    const mountable = collectMountable(getEnabledModules());

    for (const Provider of mountable) {
        router.use(new Provider().buildRouter());
    }

    logger.info(`@http-bootstrap: mounted ${mountable.length}/${countAll()} controllers durationMs=${Date.now() - startedAt}`);

    return router;
};

export default mountHttpRoutes;
