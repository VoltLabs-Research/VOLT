import { Router } from 'express';
import { container } from 'tsyringe';
import logger from '@/src/shared/infrastructure/logger';

// Module DI Registrations
import { registerApiTrackerDependencies } from '@/src/modules/api-tracker/infrastructure/di/container';
import { registerSystemDependencies } from '@/src/modules/system/infrastructure/di/container';
import { registerRasterDependencies } from '@/src/modules/raster/infrastructure/di/container';
import { registerContainerDependencies } from '@/src/modules/container/infrastructure/di/container';
import { registerPluginDependencies } from '@/src/modules/plugin/infrastructure/di/container';
import { registerTrajectoryDependencies } from '@/src/modules/trajectory/infrastructure/di/container';
import { registerTeamDependencies } from '@/src/modules/team/infrastructure/di/container';
import { registerSSHDependencies } from '@/src/modules/ssh/infrastructure/di/container';
import { registerSocketModule } from '@/src/modules/socket/infrastructure/di/SocketModule';

// Tokens for Queue Startup
import { TRAJECTORY_TOKENS } from '@/src/modules/trajectory/infrastructure/di/TrajectoryTokens';
import { RASTER_TOKENS } from '@/src/modules/raster/infrastructure/di/RasterTokens';
import { IJobQueueService } from '@/src/modules/jobs/domain/ports/IJobQueueService';

// HTTP Modules
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';
import { AuthHttpModule } from '@/src/modules/auth/infrastructure/http/AuthHttpModule';
import { SessionHttpModule } from '@/src/modules/session/infrastructure/http/SessionHttpModule';
import { TeamHttpModule } from '@/src/modules/team/infrastructure/http/TeamHttpModule';
import { TeamMemberHttpModule } from '@/src/modules/team/infrastructure/http/TeamMemberHttpModule';
import { TeamInvitationHttpModule } from '@/src/modules/team/infrastructure/http/TeamInvitationHttpModule';
import { TeamRoleHttpModule } from '@/src/modules/team/infrastructure/http/TeamRoleHttpModule';
import { ChatHttpModule } from '@/src/modules/chat/infrastructure/http/ChatHttpModule';
import { ChatMessageHttpModule } from '@/src/modules/chat/infrastructure/http/ChatMessageHttpModule';
import { NotificationHttpModule } from '@/src/modules/notification/infrastructure/http/NotificationHttpModule';
import { SshConnectionHttpModule } from '@/src/modules/ssh/infrastructure/http/SshConnectionHttpModule';
import { ContainerHttpModule } from '@/src/modules/container/infrastructure/http/ContainerHttpModule';
import { SshFileExplorerHttpModule } from '@/src/modules/ssh/infrastructure/http/SshFileExplorerHttpModule';
import { TrajectoryHttpModule } from '@/src/modules/trajectory/infrastructure/http/TrajectoryHttpModule';
import { TrajectoryVfsHttpModule } from '@/src/modules/trajectory/infrastructure/http/TrajectoryVfsHttpModule';
import { AnalysisHttpModule } from '@/src/modules/analysis/infrastructure/http/AnalysisHttpModule';
import { PluginHttpModule } from '@/src/modules/plugin/infrastructure/http/PluginHttpModule';
import { RasterHttpModule } from '@/src/modules/raster/infrastructure/http/RasterHttpModule';
import { SimulationCellHttpModule } from '@/src/modules/simulation-cell/infrastructure/http/SimulationCellHttpModule';
import { DailyActivityHttpModule } from '@/src/modules/daily-activity/infrastructure/http/DailyActivityHttpModule';
import { ApiTrackerHttpModule } from '@/src/modules/api-tracker/infrastructure/http/ApiTrackerHttpModule';
import { SystemHttpModule } from '@/src/modules/system/infrastructure/http/SystemHttpModule';

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
    SshConnectionHttpModule,
    ContainerHttpModule,
    TrajectoryHttpModule,
    TrajectoryVfsHttpModule,
    AnalysisHttpModule,
    PluginHttpModule,
    RasterHttpModule,
    SimulationCellHttpModule,
    DailyActivityHttpModule,
    ApiTrackerHttpModule,
    SystemHttpModule,
    SshFileExplorerHttpModule
];

/**
 * Register all module dependencies in the DI container
 */
export const registerAllDependencies = (): void => {
    registerApiTrackerDependencies();
    registerSystemDependencies();
    registerRasterDependencies();
    registerContainerDependencies();
    registerPluginDependencies();
    registerTrajectoryDependencies();
    registerTeamDependencies();
    registerSSHDependencies();
    registerSocketModule();
};

/**
 * Start all job queues
 */
export const startJobQueues = async (): Promise<void> => {
    try {
        const trajectoryQueue = container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.TrajectoryProcessingQueue);
        await trajectoryQueue.start();
        logger.info('@bootstrap: TrajectoryQueue started');

        const cloudUploadQueue = container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.CloudUploadQueue);
        await cloudUploadQueue.start();
        logger.info('@bootstrap: CloudUploadQueue started');

        const rasterQueue = container.resolve<IJobQueueService>(RASTER_TOKENS.RasterizerQueue);
        await rasterQueue.start();
        logger.info('@bootstrap: RasterQueue started');
    } catch (error) {
        logger.error(`@bootstrap: Failed to start job queues: ${error}`);
        throw error;
    }
};

/**
 * Mount all module routes on the Express app
 */
export const mountAllRoutes = (): Router => {
    const router = Router();

    for (const module of HTTP_MODULES) {
        router.use(module.basePath, module.router);
    }

    return router;
};
