import MinioStorageService from '@/src/shared/infrastructure/services/MinioStorageService';
import TempFileService from '@/src/shared/infrastructure/services/TempFileService';
import FileExtractorService from '@/src/shared/infrastructure/services/FileExtractorService';
import RedisEventBus from '@/src/shared/infrastructure/events/RedisEventBus';
import { registerAuthDependencies } from '@/src/modules/auth/infrastructure/di/container';
import { registerTeamDependencies } from '@/src/modules/team/infrastructure/di/container';
import { registerContainerDependencies } from '@/src/modules/container/infrastructure/di/container';
import { registerPluginDependencies } from '@/src/modules/plugin/infrastructure/di/container';
import { registerTrajectoryDependencies } from '@/src/modules/trajectory/infrastructure/di/container';
import { registerSessionDependencies } from '@/src/modules/session/infrastructure/di/container';
import { registerApiTrackerDependencies } from '@/src/modules/api-tracker/infrastructure/di/container';
import { registerRasterDependencies } from '@/src/modules/raster/infrastructure/di/container';
import { registerSystemDependencies } from '@/src/modules/system/infrastructure/di/container';
import { registerNotificationDependencies } from '@/src/modules/notification/infrastructure/di/container';
import { registerAnalysisDependencies } from '@/src/modules/analysis/infrastructure/di/container';
import { registerChatDependencies } from '@/src/modules/chat/infrastructure/di/container';
import { registerDailyActivityDependencies } from '@/src/modules/daily-activity/infrastructure/di/container';
import { registerJobsDependencies } from '@/src/modules/jobs/infrastructure/di/container';
import { registerSSHDependencies } from '@/src/modules/ssh/infrastructure/di/container';
import { registerSocketModule } from '@/src/modules/socket/infrastructure/di/SocketModule';
import { registerSimulationCellDependencies } from '@/src/modules/simulation-cell/infrastructure/di/container';
import { SHARED_TOKENS } from '@/src/shared/infrastructure/di/SharedTokens';
import { createRedisClient } from '@/src/core/redis';
import { container } from 'tsyringe';

/**
 * Register all dependencies in the DI container.
 */
container.registerSingleton(SHARED_TOKENS.EventBus, RedisEventBus);
container.registerSingleton(SHARED_TOKENS.StorageService, MinioStorageService);
container.registerSingleton(SHARED_TOKENS.TempFileService, TempFileService);
container.registerSingleton(SHARED_TOKENS.FileExtractorService, FileExtractorService);

registerAuthDependencies();
registerTeamDependencies();
registerContainerDependencies();
registerPluginDependencies();
registerTrajectoryDependencies();
registerSessionDependencies();
registerApiTrackerDependencies();
registerRasterDependencies();
registerSystemDependencies();
registerNotificationDependencies();
registerAnalysisDependencies();
registerChatDependencies();
registerDailyActivityDependencies();
registerJobsDependencies();
registerSSHDependencies();
registerSocketModule();
registerSimulationCellDependencies();

const redisClient = createRedisClient();
const redisBlockingClient = createRedisClient();

container.registerInstance(SHARED_TOKENS.RedisClient, redisClient);
container.registerInstance(SHARED_TOKENS.RedisBlockingClient, redisBlockingClient);