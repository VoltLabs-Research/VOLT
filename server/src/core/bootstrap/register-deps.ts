import { registerAuthDependencies } from '@modules/auth/infrastructure/di/container';
import { registerAnalysisDependencies } from '@modules/analysis/infrastructure/di/container';
import { registerAIDependencies } from '@modules/ai/infrastructure/di/container';
import { createRedisClient } from '@core/config/redis';
import { registerChatDependencies } from '@modules/chat/infrastructure/di/container';
import { registerContainerDependencies } from '@modules/container/infrastructure/di/container';
import { registerDailyActivityDependencies } from '@modules/daily-activity/infrastructure/di/container';
import { registerJobsDependencies } from '@modules/jobs/infrastructure/di/container';
import { registerNotificationDependencies } from '@modules/notification/infrastructure/di/container';
import { registerPluginDependencies, initializeNodeHandlers } from '@modules/plugin/infrastructure/di/container';
import { registerRasterDependencies } from '@modules/raster/infrastructure/di/container';
import { registerScriptingDependencies } from '@modules/scripting/infrastructure/di/container';
import { registerSessionDependencies } from '@modules/session/infrastructure/di/container';
import { registerSharedDependencies } from '@shared/infrastructure/di/container';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { registerSimulationCellDependencies } from '@modules/simulation-cell/infrastructure/di/container';
import { registerSocketDependencies } from '@modules/socket/infrastructure/di/container';
import { registerSSHDependencies } from '@modules/ssh/infrastructure/di/container';
import { registerSystemDependencies } from '@modules/system/infrastructure/di/container';
import { registerTeamDependencies } from '@modules/team/infrastructure/di/container';
import { registerTeamClusterDependencies } from '@modules/team-cluster/infrastructure/di/container';
import { registerTrajectoryDependencies } from '@modules/trajectory/infrastructure/di/container';
import FileExtractorService from '@shared/infrastructure/services/FileExtractorService';
import RedisEventBus from '@shared/infrastructure/events/RedisEventBus';
import MinioStorageService from '@shared/infrastructure/services/MinioStorageService';
import TempFileService from '@shared/infrastructure/services/TempFileService';
import { container } from 'tsyringe';

let dependenciesRegistered = false;

export const registerAllDependencies = (): void => {
    if (dependenciesRegistered) {
        return;
    }

    const redisClient = createRedisClient();
    const storageService = new MinioStorageService();

    container.registerInstance(SHARED_TOKENS.RedisClient, redisClient);
    container.registerSingleton(SHARED_TOKENS.EventBus, RedisEventBus);
    container.registerInstance(SHARED_TOKENS.StorageService, storageService);
    container.registerSingleton(SHARED_TOKENS.TempFileService, TempFileService);
    container.registerSingleton(SHARED_TOKENS.FileExtractorService, FileExtractorService);
    registerSharedDependencies();

    registerAuthDependencies();
    registerTeamDependencies();
    registerTeamClusterDependencies();
    registerContainerDependencies();
    registerPluginDependencies();
    registerScriptingDependencies();
    registerTrajectoryDependencies();
    registerSessionDependencies();
    registerRasterDependencies();
    registerSystemDependencies();
    registerNotificationDependencies();
    registerAnalysisDependencies();
    registerChatDependencies();
    registerDailyActivityDependencies();
    registerJobsDependencies();
    registerSSHDependencies();
    registerSocketDependencies();
    registerSimulationCellDependencies();
    registerAIDependencies();

    initializeNodeHandlers();

    dependenciesRegistered = true;
};
