import { Router } from 'express';
import { getEnabledModules } from '@core/bootstrap/module-state';
import logger from '@shared/infrastructure/logger';

/** Anything that can produce an Express router — a pollium Controller subclass or a standalone proxy controller. */
interface RouterProvider {
    buildRouter(): Router;
}

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
import LatexController from '@modules/latex/controllers/LatexController';
import WhiteboardController from '@modules/whiteboards/controllers/WhiteboardController';
import AiController from '@modules/ai/controllers/AiController';
import AnalysisController from '@modules/analysis/controllers/AnalysisController';
import ProvenanceController from '@modules/analysis/controllers/ProvenanceController';
import DashboardController from '@modules/dashboard/controllers/DashboardController';
import DailyActivityController from '@modules/daily-activity/controllers/DailyActivityController';
import EarlyAccessController from '@modules/early-access/controllers/EarlyAccessController';

interface ControllerBinding {
    moduleKey: string;
    Controller: new () => RouterProvider;
}

/**
 * Pollium-style routing: every controller carries its own wire paths (@Route)
 * and its own guards (@Middleware(protect, teamScoped(...))). Mounting is just
 * "build the router of every enabled module's controller" — no per-module route
 * file, no createHttpModule, no mount-time auth/team-scope layer.
 */
const CONTROLLERS: ControllerBinding[] = [
    { moduleKey: 'system', Controller: SystemController },
    { moduleKey: 'auth', Controller: AuthController },
    { moduleKey: 'session', Controller: SessionController },
    { moduleKey: 'team', Controller: TeamController },
    { moduleKey: 'team', Controller: TeamMemberController },
    { moduleKey: 'team', Controller: TeamRoleController },
    { moduleKey: 'team', Controller: TeamInvitationController },
    { moduleKey: 'team', Controller: SecretKeyController },
    { moduleKey: 'team', Controller: TeamAIIntegrationController },
    { moduleKey: 'cluster', Controller: ClusterController },
    { moduleKey: 'cluster', Controller: ClusterLifecycleController },
    { moduleKey: 'cluster', Controller: ClusterObjectController },
    { moduleKey: 'cluster', Controller: ClusterObjectStoreProxyController },
    { moduleKey: 'container', Controller: ContainerController },
    { moduleKey: 'trajectory', Controller: TrajectoryController },
    { moduleKey: 'trajectory', Controller: CanvasController },
    { moduleKey: 'trajectory', Controller: DiscoverController },
    { moduleKey: 'plugin', Controller: PluginController },
    { moduleKey: 'scripting', Controller: ScriptingController },
    { moduleKey: 'jobs', Controller: JobsController },
    { moduleKey: 'raster', Controller: RasterController },
    { moduleKey: 'simulation-cell', Controller: SimulationCellController },
    { moduleKey: 'chat', Controller: ChatController },
    { moduleKey: 'latex', Controller: LatexController },
    { moduleKey: 'whiteboards', Controller: WhiteboardController },
    { moduleKey: 'ai', Controller: AiController },
    { moduleKey: 'analysis', Controller: AnalysisController },
    { moduleKey: 'analysis', Controller: ProvenanceController },
    { moduleKey: 'dashboard', Controller: DashboardController },
    { moduleKey: 'daily-activity', Controller: DailyActivityController },
    { moduleKey: 'early-access', Controller: EarlyAccessController }
];

const mountHttpRoutes = (): Router => {
    const startedAt = Date.now();
    const router = Router();
    const enabled = getEnabledModules();

    let mounted = 0;
    for (const { moduleKey, Controller } of CONTROLLERS) {
        if (!enabled.has(moduleKey)) {
            continue;
        }
        router.use(new Controller().buildRouter());
        mounted += 1;
    }

    logger.info(`@http-bootstrap: mounted ${mounted}/${CONTROLLERS.length} controllers durationMs=${Date.now() - startedAt}`);

    return router;
};

export default mountHttpRoutes;
