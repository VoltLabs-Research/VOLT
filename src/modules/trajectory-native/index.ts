import {
    createFilterEvaluatorService,
    createGlbExporterService,
    NativeModuleLoader,
    createRasterizerService,
    createTrajectoryParserService,
    TrajectoryPluginParserService,
    type FilterEvaluatorService,
    type GlbExporterService,
    type RasterizerService,
    type TrajectoryParserService
} from './services';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';

interface TrajectoryNativeModule {
    nativeModuleLoader: NativeModuleLoader;
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    rasterizerService: RasterizerService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
}

export const createTrajectoryNativeModule = (
    objectStore: ClusterObjectStore,
    queueService: QueueService,
    redisConnectionService: RedisConnectionService
): TrajectoryNativeModule => {
    const nativeModuleLoader = new NativeModuleLoader();
    const trajectoryParserService = createTrajectoryParserService(objectStore, nativeModuleLoader);
    const trajectoryPluginParserService = new TrajectoryPluginParserService(objectStore);
    const rasterizerService = createRasterizerService(objectStore, nativeModuleLoader);
    const glbExporterService = createGlbExporterService(
        objectStore,
        nativeModuleLoader,
        trajectoryParserService,
        queueService,
        redisConnectionService
    );
    const filterEvaluatorService = createFilterEvaluatorService(
        objectStore,
        nativeModuleLoader,
        trajectoryParserService,
        trajectoryPluginParserService
    );

    return {
        nativeModuleLoader,
        trajectoryParserService,
        trajectoryPluginParserService,
        rasterizerService,
        glbExporterService,
        filterEvaluatorService
    };
};
