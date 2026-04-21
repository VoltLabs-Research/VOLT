import 'reflect-metadata';
import { container } from 'tsyringe';
import { createRedisClient } from '@core/config/redis';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { applyModuleManifests } from '@shared/infrastructure/di/ModuleManifest';
import type { ModuleManifest } from '@shared/infrastructure/di/ModuleManifest';
import FileExtractorService from '@shared/infrastructure/services/FileExtractorService';
import RedisEventBus from '@shared/infrastructure/events/RedisEventBus';
import MinioStorageService from '@shared/infrastructure/services/MinioStorageService';
import TempFileService from '@shared/infrastructure/services/TempFileService';

import { sharedDIManifest } from '@shared/infrastructure/di/manifest';
import { aiDIManifest } from '@modules/ai/infrastructure/di/manifest';
import { analysisDIManifest } from '@modules/analysis/infrastructure/di/manifest';
import { authDIManifest } from '@modules/auth/infrastructure/di/manifest';
import { chatDIManifest } from '@modules/chat/infrastructure/di/manifest';
import { containerDIManifest } from '@modules/container/infrastructure/di/manifest';
import { dailyActivityDIManifest } from '@modules/daily-activity/infrastructure/di/manifest';
import { jobsDIManifest } from '@modules/jobs/infrastructure/di/manifest';
import { latexDIManifest } from '@modules/latex/infrastructure/di/manifest';
import { notificationDIManifest } from '@modules/notification/infrastructure/di/manifest';
import { pluginDIManifest } from '@modules/plugin/infrastructure/di/manifest';
import { rasterDIManifest } from '@modules/raster/infrastructure/di/manifest';
import { scriptingDIManifest } from '@modules/scripting/infrastructure/di/manifest';
import { sessionDIManifest } from '@modules/session/infrastructure/di/manifest';
import { simulationCellDIManifest } from '@modules/simulation-cell/infrastructure/di/manifest';
import { socketDIManifest } from '@modules/socket/infrastructure/di/manifest';
import { sshDIManifest } from '@modules/ssh/infrastructure/di/manifest';
import { systemDIManifest } from '@modules/system/infrastructure/di/manifest';
import { teamDIManifest } from '@modules/team/infrastructure/di/manifest';
import { teamClusterDIManifest } from '@modules/team-cluster/infrastructure/di/manifest';
import { trajectoryDIManifest } from '@modules/trajectory/infrastructure/di/manifest';
import { whiteboardDIManifest } from '@modules/whiteboards/infrastructure/di/manifest';

const MODULE_MANIFESTS: readonly ModuleManifest[] = [
    sharedDIManifest,
    authDIManifest,
    teamDIManifest,
    teamClusterDIManifest,
    containerDIManifest,
    pluginDIManifest,
    scriptingDIManifest,
    latexDIManifest,
    trajectoryDIManifest,
    sessionDIManifest,
    rasterDIManifest,
    systemDIManifest,
    notificationDIManifest,
    analysisDIManifest,
    chatDIManifest,
    dailyActivityDIManifest,
    jobsDIManifest,
    sshDIManifest,
    socketDIManifest,
    simulationCellDIManifest,
    aiDIManifest,
    whiteboardDIManifest
];

let dependenciesRegistered = false;

const registerInfrastructureSingletons = (): void => {
    const redisClient = createRedisClient();
    const storageService = new MinioStorageService();

    container.registerInstance(SHARED_TOKENS.RedisClient, redisClient);
    container.registerSingleton(SHARED_TOKENS.EventBus, RedisEventBus);
    container.registerInstance(SHARED_TOKENS.StorageService, storageService);
    container.registerSingleton(SHARED_TOKENS.TempFileService, TempFileService);
    container.registerSingleton(SHARED_TOKENS.FileExtractorService, FileExtractorService);
};

export const registerAllDependencies = (): void => {
    if (dependenciesRegistered) {
        return;
    }

    registerInfrastructureSingletons();
    applyModuleManifests(MODULE_MANIFESTS);

    dependenciesRegistered = true;
};
