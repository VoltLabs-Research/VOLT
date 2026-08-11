import { Router } from 'express';
import { createUserFilesRouter } from '@shared/infrastructure/http/user-files-router';
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
import WhiteboardController from '@modules/whiteboards/controllers/WhiteboardController';
import AiController from '@modules/ai/controllers/AiController';
import AnalysisController from '@modules/analysis/controllers/AnalysisController';
import ProvenanceController from '@modules/analysis/controllers/ProvenanceController';
import DashboardController from '@modules/dashboard/controllers/DashboardController';
import DailyActivityController from '@modules/daily-activity/controllers/DailyActivityController';

type RouterProviderClass = new () => { buildRouter(): Router };

const CONTROLLERS: Readonly<Record<string, readonly RouterProviderClass[]>> = {
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
    cluster: [ClusterController, ClusterLifecycleController, ClusterObjectController, ClusterObjectStoreProxyController],
    container: [ContainerController],
    trajectory: [TrajectoryController, CanvasController, DiscoverController],
    plugin: [PluginController],
    scripting: [ScriptingController],
    jobs: [JobsController],
    raster: [RasterController],
    'simulation-cell': [SimulationCellController],
    whiteboards: [WhiteboardController],
    ai: [AiController],
    analysis: [AnalysisController, ProvenanceController],
    dashboard: [DashboardController],
    'daily-activity': [DailyActivityController]
};

const collectMountable = (): RouterProviderClass[] => Object.values(CONTROLLERS).flat();

const mountHttpRoutes = (): Router => {
    const startedAt = Date.now();
    const router = Router();

    /* Avatars, which the browser fetches by plain URL. */
    router.use(createUserFilesRouter());

    const mountable = collectMountable();

    for (const Provider of mountable) {
        router.use(new Provider().buildRouter());
    }

    logger.info(`@http-bootstrap: mounted ${mountable.length} controllers durationMs=${Date.now() - startedAt}`);

    return router;
};

export default mountHttpRoutes;
