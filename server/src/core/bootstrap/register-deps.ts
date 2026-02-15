import MinioStorageService from '@shared/infrastructure/services/MinioStorageService';
import TempFileService from '@shared/infrastructure/services/TempFileService';
import FileExtractorService from '@shared/infrastructure/services/FileExtractorService';
import RedisEventBus from '@shared/infrastructure/events/RedisEventBus';
import { registerAuthDependencies } from '@modules/auth/infrastructure/di/container';
import { registerTeamDependencies } from '@modules/team/infrastructure/di/container';
import { registerContainerDependencies } from '@modules/container/infrastructure/di/container';
import { registerPluginDependencies, initializeNodeHandlers } from '@modules/plugin/infrastructure/di/container';
import { registerTrajectoryDependencies } from '@modules/trajectory/infrastructure/di/container';
import { registerSessionDependencies } from '@modules/session/infrastructure/di/container';
import { registerApiTrackerDependencies } from '@modules/api-tracker/infrastructure/di/container';
import { registerRasterDependencies } from '@modules/raster/infrastructure/di/container';
import { registerSystemDependencies } from '@modules/system/infrastructure/di/container';
import { registerNotificationDependencies } from '@modules/notification/infrastructure/di/container';
import { registerAnalysisDependencies } from '@modules/analysis/infrastructure/di/container';
import { registerChatDependencies } from '@modules/chat/infrastructure/di/container';
import { registerDailyActivityDependencies } from '@modules/daily-activity/infrastructure/di/container';
import { registerJobsDependencies } from '@modules/jobs/infrastructure/di/container';
import { registerSSHDependencies } from '@modules/ssh/infrastructure/di/container';
import { registerSocketModule } from '@modules/socket/infrastructure/di/SocketModule';
import { registerSimulationCellDependencies } from '@modules/simulation-cell/infrastructure/di/container';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { createRedisConnection } from '@core/config/redis';
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

// TODO(CORE-011): These Redis clients are created at import time as a side effect.
// This is necessary because DI consumers (e.g. BullMQ queues, RedisEventBus) need
// dedicated connections that are separate from the main `redis` singleton initialized
// in initializeRedis(). Consider deferring creation to a lazy factory if startup
// ordering issues arise.
const redisClient = createRedisConnection();
const redisBlockingClient = createRedisConnection();

container.registerInstance(SHARED_TOKENS.RedisClient, redisClient);
container.registerInstance(SHARED_TOKENS.RedisBlockingClient, redisBlockingClient);

initializeNodeHandlers();
